import { describe, expect, it } from 'vitest';

import { PolygonDistance } from '@/engine/sim/polygon-distance';
import { LocalProjection } from '@/lib/math/geo';

describe('distance to a polygon', () => {
  // A 0.2° square around (29, 41).
  const square = new PolygonDistance(
    [
      [28.9, 40.9],
      [29.1, 40.9],
      [29.1, 41.1],
      [28.9, 41.1],
      [28.9, 40.9],
    ],
    new LocalProjection(29, 41),
  );

  it('is zero inside', () => {
    expect(square.distanceKm(29, 41)).toBe(0);
  });

  it('is the distance to the nearest edge outside', () => {
    // 0.1° of latitude north of the top edge.
    expect(square.distanceKm(29, 41.2)).toBeCloseTo(11.12, 1);
  });
});
