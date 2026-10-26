import { describe, expect, it } from 'vitest';

import { okadaUz } from '@/engine/tsunami/okada';
import {
  averageSlipM,
  faultRectangles,
  rectangleUplift,
  RIGIDITY_PA,
} from '@/engine/tsunami/source';
import { EARTH_RADIUS_KM } from '@/lib/math/geo';

const KM_PER_DEG = (EARTH_RADIUS_KM * Math.PI) / 180;

describe('tsunami source', () => {
  it('derives the average slip from the moment, D = M0 / (μ·A)', () => {
    expect(RIGIDITY_PA).toBe(3e10);
    // Mw 7: M0 = 10^(1.5·7 + 9.05) N·m.
    const m0 = 10 ** (1.5 * 7 + 9.05);
    expect(averageSlipM(7, 1000)).toBeCloseTo(m0 / (3e10 * 1e9), 6);
  });

  it('builds one rectangle per trace segment with strike, width and rake split', () => {
    const [rect] = faultRectangles({
      mw: 7,
      areaKm2: 1000,
      trace: [
        [29, 40.8],
        [29, 40.9],
      ],
      dipDeg: 60,
      rakeDeg: -90,
      topDepthKm: 1,
      bottomDepthKm: 1 + 10 * Math.sin(Math.PI / 3),
    });
    expect(rect?.strikeDeg).toBeCloseTo(0, 6);
    expect(rect?.widthKm).toBeCloseTo(10, 6);
    expect(rect?.lengthKm).toBeCloseTo(0.1 * KM_PER_DEG, 3);
    expect(rect?.strikeSlipM).toBeCloseTo(0, 9);
    expect(rect?.dipSlipM).toBeCloseTo(-averageSlipM(7, 1000), 9);
    // The lower edge starts W·cos δ = 5 km east (strike + 90°) of the trace start.
    expect(
      ((rect?.originLon ?? 0) - 29) * KM_PER_DEG * Math.cos((40.8 * Math.PI) / 180),
    ).toBeCloseTo(5, 2);
  });

  it('evaluates Okada in the rectangle’s local frame', () => {
    // Strike north: x is distance north of the origin, y distance west of it.
    const rect = {
      originLon: 29,
      originLat: 40,
      strikeDeg: 0,
      lengthKm: 20,
      widthKm: 10,
      dipDeg: 45,
      bottomDepthKm: 10,
      strikeSlipM: 0.5,
      dipSlipM: 1,
    };
    const lon = 29 - 3 / (KM_PER_DEG * Math.cos((40 * Math.PI) / 180));
    const lat = 40 + 4 / KM_PER_DEG;
    expect(rectangleUplift(rect, lon, lat)).toBeCloseTo(okadaUz(4, 3, 10, 45, 20, 10, 0.5, 1), 6);
  });
});
