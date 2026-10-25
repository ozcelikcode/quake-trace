import { describe, expect, it } from 'vitest';

import { IASP91_CRUST, type VelocityLayer } from '@/engine/velocity/layered-model';
import {
  directTravelTime,
  firstArrivalTime,
  headWaveTravelTime,
  TravelTimeCurve,
} from '@/engine/velocity/travel-time';

const halfSpace: VelocityLayer[] = [{ topKm: 0, vpKmS: 6, vsKmS: 3.5 }];
// Two layers: 20 km at 6 km/s over an 8 km/s half-space (P).
const twoLayers: VelocityLayer[] = [
  { topKm: 0, vpKmS: 6, vsKmS: 3.5 },
  { topKm: 20, vpKmS: 8, vsKmS: 4.6 },
];

describe('travel times in a layered model', () => {
  it('match the straight-ray solution in a half-space', () => {
    expect(directTravelTime(halfSpace, 'P', 30, 10)).toBeCloseTo(Math.hypot(30, 10) / 6, 10);
    expect(firstArrivalTime(halfSpace, 'S', 30, 10)).toBeCloseTo(Math.hypot(30, 10) / 3.5, 10);
  });

  it('give the analytic head wave beyond the critical distance', () => {
    // t = x/v2 + (2·d − h)·√(1/v1² − 1/v2²) = 200/8 + 30·√(1/36 − 1/64)
    const expected = 200 / 8 + 30 * Math.sqrt(1 / 36 - 1 / 64);
    expect(headWaveTravelTime(twoLayers, 'P', 200, 10, 1)).toBeCloseTo(expected, 10);
    // Critical distance: 30·tan(asin(6/8)) ≈ 34.0 km.
    expect(headWaveTravelTime(twoLayers, 'P', 30, 10, 1)).toBe(Number.POSITIVE_INFINITY);
  });

  it('switch from the direct wave to the head wave at the crossover distance', () => {
    expect(firstArrivalTime(twoLayers, 'P', 50, 10)).toBeCloseTo(Math.hypot(50, 10) / 6, 10);
    expect(firstArrivalTime(twoLayers, 'P', 200, 10)).toBeCloseTo(
      headWaveTravelTime(twoLayers, 'P', 200, 10, 1),
      10,
    );
  });

  it('trace the direct ray through several layers', () => {
    // Vertical ray from 25 km depth in IASP91: 20 km at 5.8 km/s, then 5 km at 6.5 km/s.
    expect(directTravelTime(IASP91_CRUST, 'P', 0, 25)).toBeCloseTo(20 / 5.8 + 5 / 6.5, 6);
    // Continuous across the interface.
    const above = directTravelTime(IASP91_CRUST, 'P', 40, 19.999);
    const below = directTravelTime(IASP91_CRUST, 'P', 40, 20.001);
    expect(Math.abs(above - below)).toBeLessThan(1e-3);
  });

  it('increase monotonically with distance', () => {
    let previous = 0;
    for (let x = 0; x <= 400; x += 5) {
      const t = firstArrivalTime(IASP91_CRUST, 'S', x, 12);
      expect(t).toBeGreaterThan(previous);
      previous = t;
    }
  });

  it('are reproduced by the tabulated curve', () => {
    const curve = new TravelTimeCurve(IASP91_CRUST, 'P', 12, 500);
    for (const x of [0, 3.3, 47.8, 151.2, 299.9, 480]) {
      expect(curve.time(x)).toBeCloseTo(firstArrivalTime(IASP91_CRUST, 'P', x, 12), 2);
    }
  });
});
