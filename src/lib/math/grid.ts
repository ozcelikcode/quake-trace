import type { GridSpec } from '@/types/grid';

/** Flat index of the cell containing (lon, lat) on a north-up grid, or -1 outside the grid. */
export function cellIndex(spec: GridSpec, lon: number, lat: number): number {
  const ix = Math.floor((lon - spec.west) / spec.dLon);
  const iy = Math.floor((spec.north - lat) / spec.dLat);
  if (ix < 0 || ix >= spec.nx || iy < 0 || iy >= spec.ny) return -1;
  return iy * spec.nx + ix;
}
