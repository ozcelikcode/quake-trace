import { describe, expect, it } from 'vitest';

import { isolineSegments } from '@/lib/math/isolines';

describe('isolines', () => {
  // Distance from the centre of a 41 × 41 grid (cell-centre coordinates).
  const n = 41;
  const values = new Float32Array(n * n);
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      values[row * n + col] = Math.hypot(col + 0.5 - 20.5, row + 0.5 - 20.5);
    }
  }

  it('traces a circle at the requested level', () => {
    const segments = isolineSegments(values, n, n, 10);
    expect(segments.length).toBeGreaterThan(40 * 4);
    for (let i = 0; i < segments.length; i += 2) {
      const radius = Math.hypot((segments[i] ?? 0) - 20.5, (segments[i + 1] ?? 0) - 20.5);
      expect(Math.abs(radius - 10)).toBeLessThan(0.1);
    }
  });

  it('returns nothing for levels outside the data', () => {
    expect(isolineSegments(values, n, n, 100)).toHaveLength(0);
  });

  it('skips squares with missing values', () => {
    const holed = Float32Array.from(values);
    holed.fill(Number.NaN);
    expect(isolineSegments(holed, n, n, 10)).toHaveLength(0);
  });
});
