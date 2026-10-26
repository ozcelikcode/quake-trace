import { describe, expect, it } from 'vitest';

import type { Faults } from '@/data/schemas';
import { ruptureExtentKm } from '@/engine/rupture/finite-fault';
import {
  customScenario,
  defaultDraft,
  magnitudeRange,
  normalizeDraft,
} from '@/features/scenario/lib/custom-scenario';
import { haversineKm } from '@/lib/math/geo';

const range = (avg: number) => ({ min: avg, avg, max: avg });

/** One east–west fault of about 84 km along 40.8° N (0.01° of longitude ≈ 0.842 km). */
const faults: Faults = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [28, 40.8],
          [28.5, 40.8],
          [29, 40.8],
        ],
      },
      properties: {
        id: 'TEST01',
        faultType: 'right-lateral',
        strikeDeg: range(90),
        dipDeg: range(90),
        rakeDeg: range(180),
        upperDepthKm: 0.5,
        lowerDepthKm: 18,
        lengthKm: 84,
        widthKm: range(17.5),
        slipRateMmYr: { min: 10, mean: 15, max: 20 },
        mwMax: { p05: 6.9, avg: 7.11, p95: 7.37 },
      },
    },
  ],
};
const lengthKm = haversineKm(28, 40.8, 29, 40.8);

describe('editor scenarios', () => {
  it('offers magnitudes up to the 95th percentile of the EFSM20 maximum, rounded down', () => {
    const [fault] = faults.features;
    if (!fault) throw new Error('fixture');
    expect(magnitudeRange(fault)).toEqual({ min: 5, max: 7.3 });
  });

  it('starts at Mw 7 in the middle of the trace and of the seismogenic layer', () => {
    expect(defaultDraft(faults, 'TEST01')).toEqual({
      faultId: 'TEST01',
      mw: 7,
      hypocenterKm: Math.round(lengthKm / 2),
      depthKm: 9,
      seed: 1,
    });
  });

  it('keeps a draft inside the fault limits', () => {
    const draft = { faultId: 'TEST01', mw: 7.9, hypocenterKm: 500, depthKm: 0, seed: 3 };
    expect(normalizeDraft(draft, faults)).toEqual({
      faultId: 'TEST01',
      mw: 7.3,
      hypocenterKm: Math.round(lengthKm),
      depthKm: 1,
      seed: 3,
    });
  });

  it('leaves the extent to the engine, which centres the W&C94 length on the hypocentre', () => {
    const scenario = customScenario(
      { faultId: 'TEST01', mw: 6.5, hypocenterKm: 40, depthKm: 10, seed: 7 },
      faults,
    );
    expect(scenario).toMatchObject({ id: 'custom', seed: 7 });
    expect(scenario.rupture).toMatchObject({ mw: 6.5, hypocenterKm: 40, hypocenterDepthKm: 10 });
    expect(scenario.rupture.startKm).toBeUndefined();
    // W&C94 strike-slip: log A = −3.42 + 0.90 M → 386 km² at Mw 6.5, over a 17.5 km width.
    const { startKm, endKm } = ruptureExtentKm(scenario.rupture);
    expect(endKm - startKm).toBeCloseTo(10 ** (-3.42 + 0.9 * 6.5) / 17.5, 1);
    expect((startKm + endKm) / 2).toBeCloseTo(40, 6);
  });
});
