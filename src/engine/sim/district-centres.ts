import type { GridSpec } from '@/types/grid';

/**
 * Population-weighted centre of each district (cell centres weighted by residents), or the mean
 * of its cell centres when nobody lives there. Keyed by district index.
 */
export function districtCentres(
  spec: GridSpec,
  districtCells: Float32Array,
  population: Float32Array,
): Map<number, { lon: number; lat: number }> {
  const sums = new Map<number, { lon: number; lat: number; weight: number }>();
  for (let row = 0; row < spec.ny; row++) {
    const lat = spec.north - (row + 0.5) * spec.dLat;
    for (let col = 0; col < spec.nx; col++) {
      const cell = row * spec.nx + col;
      const index = districtCells[cell] ?? Number.NaN;
      if (Number.isNaN(index)) continue;
      const lon = spec.west + (col + 0.5) * spec.dLon;
      // Unpopulated cells carry a tiny weight so empty districts fall back to their mean.
      const weight = Math.max(0, population[cell] ?? 0) + 1e-6;
      const sum = sums.get(index) ?? { lon: 0, lat: 0, weight: 0 };
      sum.lon += lon * weight;
      sum.lat += lat * weight;
      sum.weight += weight;
      sums.set(index, sum);
    }
  }
  return new Map(
    [...sums].map(([index, sum]) => [
      index,
      { lon: sum.lon / sum.weight, lat: sum.lat / sum.weight },
    ]),
  );
}
