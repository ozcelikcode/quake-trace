import { describe, expect, it } from 'vitest';

import { haversineKm } from '@/lib/math/geo';
import {
  cumulativeLengthsKm,
  kmAtLongitude,
  nearestOnPath,
  pointAtKm,
  slicePath,
} from '@/lib/math/polyline';
import type { LonLat } from '@/types/scenario';

// Westward path along 40.8° N, like the Main Marmara Fault trace.
const path: LonLat[] = [
  [29.2, 40.8],
  [28.8, 40.8],
  [28.4, 40.8],
];
const cumulative = cumulativeLengthsKm(path);
const segment = haversineKm(29.2, 40.8, 28.8, 40.8);

describe('polylines', () => {
  it('accumulates segment lengths', () => {
    expect(cumulative).toHaveLength(3);
    expect(cumulative[2]).toBeCloseTo(2 * segment, 6);
  });

  it('interpolates points and reports the local bearing', () => {
    const { point, bearingDeg } = pointAtKm(path, cumulative, segment * 1.5);
    expect(point[0]).toBeCloseTo(28.6, 6);
    expect(bearingDeg).toBeCloseTo(270, 0);
  });

  it('slices with interpolated ends', () => {
    const slice = slicePath(path, cumulative, segment * 0.5, segment * 1.5);
    expect(slice.map((p) => Number(p[0].toFixed(6)))).toEqual([29, 28.8, 28.6]);
  });

  it('finds where the path crosses a longitude', () => {
    expect(kmAtLongitude(path, cumulative, 28.6)).toBeCloseTo(segment * 1.5, 6);
    expect(kmAtLongitude(path, cumulative, 27)).toBeUndefined();
  });
});

describe('nearest point on a path', () => {
  const path: [number, number][] = [
    [28, 40.8],
    [29, 40.8],
    [29, 41],
  ];

  it('projects onto the nearest segment', () => {
    const near = nearestOnPath(path, 28.5, 40.9);
    // 0.1° of latitude north of the first segment's midpoint.
    expect(near.distanceKm).toBeCloseTo(11.12, 1);
    expect(near.km).toBeCloseTo(haversineKm(28, 40.8, 28.5, 40.8), 0);
    const second = nearestOnPath(path, 29.2, 40.9);
    expect(second.km).toBeGreaterThan(haversineKm(28, 40.8, 29, 40.8));
  });

  it('clamps to the ends', () => {
    expect(nearestOnPath(path, 27.5, 40.8).km).toBe(0);
  });
});
