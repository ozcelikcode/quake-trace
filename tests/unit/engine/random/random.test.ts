import { describe, expect, it } from 'vitest';

import { createRandom, deriveSeed } from '@/engine/random/random';

const draw = (seed: number, count: number, pick: 'next' | 'normal') => {
  const random = createRandom(seed);
  return Array.from({ length: count }, () => random[pick]());
};

describe('seeded random numbers', () => {
  it('repeat the same stream for the same seed', () => {
    expect(draw(42, 100, 'next')).toEqual(draw(42, 100, 'next'));
    expect(draw(42, 100, 'normal')).toEqual(draw(42, 100, 'normal'));
    expect(draw(42, 10, 'next')).not.toEqual(draw(43, 10, 'next'));
  });

  it('give uniform deviates in [0, 1) with mean 1/2 and variance 1/12', () => {
    const values = draw(1, 100_000, 'next');
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
    expect(mean).toBeCloseTo(0.5, 2);
    expect(variance).toBeCloseTo(1 / 12, 2);
  });

  it('give standard normal deviates', () => {
    const values = draw(2, 100_000, 'normal');
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
    expect(mean).toBeCloseTo(0, 2);
    expect(variance).toBeCloseTo(1, 1);
    // About 4.55 % of a normal population lies beyond two standard deviations.
    const tails = values.filter((v) => Math.abs(v) > 2).length / values.length;
    expect(tails).toBeCloseTo(0.0455, 2);
  });

  it('derive stable, distinct sub-stream seeds per key', () => {
    expect(deriveSeed(1, 'KO.ARMT')).toBe(deriveSeed(1, 'KO.ARMT'));
    expect(deriveSeed(1, 'KO.ARMT')).not.toBe(deriveSeed(1, 'KO.ASYA'));
    expect(deriveSeed(1, 'KO.ARMT')).not.toBe(deriveSeed(2, 'KO.ARMT'));
  });
});
