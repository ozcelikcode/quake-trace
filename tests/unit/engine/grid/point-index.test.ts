import { describe, expect, it } from 'vitest';

import { PointIndex } from '@/engine/grid/point-index';
import { createRandom } from '@/engine/random/random';

const spec = { west: 28, north: 41.2, dLon: 0.01, dLat: 0.01, nx: 40, ny: 30 };
const RAD = Math.PI / 180;

function bruteForce(lonLat: Float32Array, lon: number, lat: number): number {
  let best = -1;
  let bestD2 = Number.POSITIVE_INFINITY;
  for (let point = 0; point < lonLat.length / 2; point++) {
    const dx = ((lonLat[2 * point] ?? 0) - lon) * Math.cos(lat * RAD);
    const dy = (lonLat[2 * point + 1] ?? 0) - lat;
    if (dx * dx + dy * dy < bestD2) {
      best = point;
      bestD2 = dx * dx + dy * dy;
    }
  }
  return best;
}

describe('nearest-point index on the grid', () => {
  const random = createRandom(7);
  const lonLat = Float32Array.from({ length: 120 }, (_, i) =>
    i % 2 === 0 ? 28 + random.next() * 0.4 : 40.9 + random.next() * 0.3,
  );
  const index = new PointIndex(spec, lonLat);

  it('agrees with a brute-force search', () => {
    for (let query = 0; query < 200; query++) {
      const lon = 28 + random.next() * 0.4;
      const lat = 40.9 + random.next() * 0.3;
      expect(index.nearest(lon, lat, 40)).toBe(bruteForce(lonLat, lon, lat));
    }
  });

  it('skips points the filter rejects and gives -1 beyond the search radius', () => {
    const lon = lonLat[0] ?? 0;
    const lat = lonLat[1] ?? 0;
    expect(index.nearest(lon, lat, 40)).toBe(0);
    expect(index.nearest(lon, lat, 40, (point) => point !== 0)).not.toBe(0);
    expect(new PointIndex(spec, Float32Array.from([28.39, 40.91])).nearest(28.0, 41.19, 3)).toBe(
      -1,
    );
  });

  it('buckets every point by its cell', () => {
    let total = 0;
    for (let cell = 0; cell < spec.nx * spec.ny; cell++) total += index.countIn(cell);
    expect(total).toBe(60);
    const cell = index.pointCell[5] ?? -1;
    expect([...index.pointsIn(cell)]).toContain(5);
  });
});
