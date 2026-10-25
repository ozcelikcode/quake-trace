import { describe, expect, it } from 'vitest';

import {
  magnitudeFromRuptureArea,
  medianRuptureAreaKm2,
  rakeClass,
} from '@/engine/rupture/scaling';

describe('Wells and Coppersmith (1994) rupture scaling', () => {
  it('classifies slip by rake like OpenQuake WC1994', () => {
    expect(rakeClass(180)).toBe('strike-slip');
    expect(rakeClass(-157)).toBe('strike-slip');
    expect(rakeClass(45)).toBe('strike-slip');
    expect(rakeClass(90)).toBe('reverse');
    expect(rakeClass(-90)).toBe('normal');
  });

  it('gives the Table 2A median rupture areas', () => {
    expect(medianRuptureAreaKm2(7, 180)).toBeCloseTo(10 ** (-3.42 + 0.9 * 7), 6);
    expect(medianRuptureAreaKm2(7, 90)).toBeCloseTo(10 ** (-3.99 + 0.98 * 7), 6);
    expect(medianRuptureAreaKm2(7, -90)).toBeCloseTo(10 ** (-2.87 + 0.82 * 7), 6);
  });

  it('gives the Table 2A magnitudes from area', () => {
    expect(magnitudeFromRuptureArea(1000, 180)).toBeCloseTo(3.98 + 1.02 * 3, 10);
    expect(magnitudeFromRuptureArea(1000, 90)).toBeCloseTo(4.33 + 0.9 * 3, 10);
    expect(magnitudeFromRuptureArea(1000, -90)).toBeCloseTo(3.93 + 1.02 * 3, 10);
  });
});
