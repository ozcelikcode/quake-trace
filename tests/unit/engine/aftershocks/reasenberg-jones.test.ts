import { describe, expect, it } from 'vitest';

import {
  exceedanceProbability,
  expectedCount,
  GENERIC_CALIFORNIA,
  sampleMagnitude,
  sampleTimeDays,
} from '@/engine/aftershocks/reasenberg-jones';
import { createRandom } from '@/engine/random/random';

/** Trapezoid integral of the Reasenberg–Jones rate, the reference for the closed form. */
function numericCount(mainshock: number, magnitude: number, t1: number, t2: number): number {
  const { a, b, p, c } = GENERIC_CALIFORNIA;
  const steps = 200_000;
  const h = (t2 - t1) / steps;
  let sum = 0;
  for (let i = 0; i <= steps; i++) {
    const weight = i === 0 || i === steps ? 0.5 : 1;
    sum += weight * (t1 + i * h + c) ** -p;
  }
  return 10 ** (a + b * (mainshock - magnitude)) * sum * h;
}

describe('Reasenberg and Jones (1989) aftershock rate', () => {
  it('uses the generic California parameters (USGS OFR 96-266)', () => {
    expect(GENERIC_CALIFORNIA).toEqual({ a: -1.67, b: 0.91, p: 1.08, c: 0.05 });
  });

  it('integrates the modified Omori rate in closed form', () => {
    for (const [t1, t2] of [
      [0, 1],
      [0.5, 3],
      [2, 3],
    ] as const) {
      expect(expectedCount(7.4, 5, t1, t2) / numericCount(7.4, 5, t1, t2)).toBeCloseTo(1, 4);
    }
  });

  it('scales by 10^b per magnitude unit and gives Poisson probabilities', () => {
    expect(expectedCount(7, 5, 0, 1) / expectedCount(6, 5, 0, 1)).toBeCloseTo(10 ** 0.91, 9);
    const p = exceedanceProbability(7, 6, 0, 1);
    expect(p).toBeCloseTo(1 - Math.exp(-expectedCount(7, 6, 0, 1)), 12);
    expect(exceedanceProbability(7, 6, 2, 3)).toBeLessThan(p);
  });

  it('samples times with the Omori distribution', () => {
    const random = createRandom(3);
    const times = Array.from({ length: 20_000 }, () => sampleTimeDays(random.next(), 3));
    const share = (limit: number) => times.filter((t) => t <= limit).length / times.length;
    for (const limit of [0.01, 0.1, 1]) {
      expect(share(limit)).toBeCloseTo(
        expectedCount(7, 3, 0, limit) / expectedCount(7, 3, 0, 3),
        1,
      );
    }
    expect(Math.min(...times)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...times)).toBeLessThanOrEqual(3);
  });

  it('samples truncated Gutenberg–Richter magnitudes', () => {
    const random = createRandom(4);
    const magnitudes = Array.from({ length: 20_000 }, () => sampleMagnitude(random.next(), 3, 7));
    const tail = (1 - 10 ** (-0.91 * 4)) ** -1;
    const aboveFour = magnitudes.filter((m) => m >= 4).length / magnitudes.length;
    expect(aboveFour).toBeCloseTo((10 ** -0.91 - 10 ** (-0.91 * 4)) * tail, 2);
    expect(Math.min(...magnitudes)).toBeGreaterThanOrEqual(3);
    expect(Math.max(...magnitudes)).toBeLessThanOrEqual(7);
  });
});
