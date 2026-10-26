import { describe, expect, it } from 'vitest';

import {
  AFTERSHOCK_DURATION_S,
  aftershockCatalog,
  MIN_MAGNITUDE,
  samplePoisson,
} from '@/engine/aftershocks/catalog';
import { expectedCount } from '@/engine/aftershocks/reasenberg-jones';
import { createRandom } from '@/engine/random/random';
import { haversineKm } from '@/lib/math/geo';

const rupture = {
  mw: 6.5,
  trace: [
    [28.5, 40.8],
    [28.9, 40.85],
  ] as [number, number][],
  dipDeg: 80,
  upperDepthKm: 1,
  lowerDepthKm: 15,
};

describe('Poisson sampler', () => {
  it.each([3, 20, 400])('has mean and variance %i', (mean) => {
    const random = createRandom(mean);
    const draws = Array.from({ length: 20_000 }, () => samplePoisson(random, mean));
    const average = draws.reduce((sum, value) => sum + value, 0) / draws.length;
    const variance = draws.reduce((sum, value) => sum + (value - average) ** 2, 0) / draws.length;
    expect(average / mean).toBeCloseTo(1, 1);
    expect(variance / mean).toBeCloseTo(1, 1);
  });
});

describe('aftershock catalog', () => {
  const catalog = aftershockCatalog(rupture, createRandom(1));

  it('draws about the Reasenberg–Jones count of M ≥ 3 shocks in three days', () => {
    const expected = expectedCount(6.5, MIN_MAGNITUDE, 0, 3);
    expect(Math.abs(catalog.count - expected)).toBeLessThan(4 * Math.sqrt(expected));
    expect(catalog.durationS).toBe(AFTERSHOCK_DURATION_S);
  });

  it('keeps events sorted, inside the window, below the mainshock and near the rupture', () => {
    for (let i = 0; i < catalog.count; i++) {
      if (i > 0) expect(catalog.timeS[i]).toBeGreaterThanOrEqual(catalog.timeS[i - 1] ?? 0);
      expect(catalog.timeS[i]).toBeLessThanOrEqual(AFTERSHOCK_DURATION_S);
      expect(catalog.magnitude[i]).toBeGreaterThanOrEqual(3);
      expect(catalog.magnitude[i]).toBeLessThanOrEqual(6.5);
      expect(catalog.depthKm[i]).toBeGreaterThanOrEqual(1);
      expect(catalog.depthKm[i]).toBeLessThanOrEqual(15);
      const fromMiddle = haversineKm(28.7, 40.825, catalog.lon[i] ?? 0, catalog.lat[i] ?? 0);
      expect(fromMiddle).toBeLessThan(60);
    }
  });

  it('forecasts hourly 24-hour probabilities that fall with time', () => {
    expect(catalog.forecastM5).toHaveLength(73);
    expect(catalog.forecastM5[0]).toBeGreaterThan(catalog.forecastM5[72] ?? 1);
    expect(catalog.forecastM6[0]).toBeLessThan(catalog.forecastM5[0] ?? 0);
  });

  it('is reproducible for a seed', () => {
    expect(aftershockCatalog(rupture, createRandom(1)).magnitude).toEqual(catalog.magnitude);
  });
});
