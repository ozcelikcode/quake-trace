import { describe, expect, it } from 'vitest';

import { buildRupture, ruptureExtentKm } from '@/engine/rupture/finite-fault';
import { magnitudeFromRuptureArea, medianRuptureAreaKm2 } from '@/engine/rupture/scaling';
import { haversineKm } from '@/lib/math/geo';
import type { FaultSource, RuptureSpec } from '@/types/scenario';

// A straight east-running trace at 40.8° N, about 84 km long.
const fault: FaultSource = {
  id: 'test',
  trace: [
    [28, 40.8],
    [29, 40.8],
  ],
  dipDeg: 90,
  rakeDeg: 180,
  upperDepthKm: 0,
  lowerDepthKm: 18,
};

function spec(overrides: Partial<RuptureSpec> = {}): RuptureSpec {
  return { fault, startKm: 10, endKm: 70, hypocenterKm: 40, hypocenterDepthKm: 12, ...overrides };
}

const options = { ruptureVelocityKmS: 2.7 };

describe('finite-fault rupture', () => {
  it('derives size and magnitude from the ruptured area', () => {
    const rupture = buildRupture(spec(), options);
    expect(rupture.lengthKm).toBe(60);
    expect(rupture.widthKm).toBeCloseTo(18, 10);
    expect(rupture.areaKm2).toBeCloseTo(1080, 6);
    expect(rupture.mw).toBeCloseTo(magnitudeFromRuptureArea(1080, 180), 10);
    expect(buildRupture(spec({ mw: 7.1 }), options).mw).toBe(7.1);
  });

  it('sizes a rupture without an extent from the W&C94 median area, centred and kept on the trace', () => {
    // Mw 6.2 strike slip: A = 10^(−3.42 + 0.9 · 6.2) km² over an 18 km wide vertical fault.
    const lengthKm = medianRuptureAreaKm2(6.2, 180) / 18;
    const centred = ruptureExtentKm({ fault, hypocenterKm: 40, hypocenterDepthKm: 10, mw: 6.2 });
    expect(centred.endKm - centred.startKm).toBeCloseTo(lengthKm, 9);
    expect((centred.startKm + centred.endKm) / 2).toBeCloseTo(40, 9);
    const atEnd = ruptureExtentKm({ fault, hypocenterKm: 1, hypocenterDepthKm: 10, mw: 6.2 });
    expect(atEnd.startKm).toBe(0);
    // A magnitude too large for the trace ruptures all of it.
    const whole = ruptureExtentKm({ fault, hypocenterKm: 40, hypocenterDepthKm: 10, mw: 8 });
    expect(whole.startKm).toBe(0);
    expect(whole.endKm).toBeCloseTo(84.3, 0);
    expect(() => ruptureExtentKm({ fault, hypocenterKm: 40, hypocenterDepthKm: 10 })).toThrow(
      RangeError,
    );
  });

  it('starts at the hypocentre and spreads at the rupture velocity', () => {
    const rupture = buildRupture(spec(), options);
    const hypo = rupture.hypocenter;
    expect(haversineKm(hypo.lon, hypo.lat, 28 + 40 / 84.3, 40.8)).toBeLessThan(1.5);
    // Farthest corner: 30 km along strike, 12 km up dip.
    expect(rupture.durationS).toBeCloseTo(Math.hypot(30, 12) / 2.7, 6);
    expect(Math.min(...rupture.traceTimesS)).toBeGreaterThan(0);
    expect(rupture.subfaults.count).toBe(1 + 15 * 3);
    expect(rupture.subfaults.timeS[0]).toBe(0);
    for (let i = 0; i < rupture.subfaults.count; i++) {
      expect(rupture.subfaults.timeS[i]).toBeLessThanOrEqual(rupture.durationS + 1e-9);
    }
  });

  it('places the down-dip edge to the right of the trace', () => {
    const dipping = buildRupture(spec({ fault: { ...fault, dipDeg: 45 } }), options);
    // Eastward trace: the fault dips south; the bottom edge lies 18 km south of the trace.
    const southernmost = Math.min(...dipping.surfaceProjection.map((p) => p[1]));
    expect(haversineKm(28.5, 40.8, 28.5, southernmost)).toBeCloseTo(18, 0);
    expect(dipping.widthKm).toBeCloseTo(18 * Math.SQRT2, 6);
  });

  it('rejects impossible ruptures', () => {
    expect(() => buildRupture(spec({ startKm: 40, endKm: 40 }), options)).toThrow(RangeError);
    expect(() => buildRupture(spec({ hypocenterKm: 80 }), options)).toThrow(RangeError);
  });
});
