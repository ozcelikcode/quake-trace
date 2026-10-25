import { DataError } from './errors';
import type { GridSpec } from './manifest';

/**
 * A regular lon/lat grid, north-up: row 0 is the northern edge, columns run west to east.
 * Values are float32 (NaN for no data), matching pipeline/src/quaketrace_pipeline/grid.py.
 */
export interface Grid {
  spec: GridSpec;
  values: Float32Array;
}

/**
 * Wraps the raw little-endian bytes. Every browser runs on little-endian hardware, so the
 * buffer is viewed directly instead of being copied through a DataView.
 */
export function decodeGrid(buffer: ArrayBuffer, spec: GridSpec): Grid {
  const expected = spec.nx * spec.ny * Float32Array.BYTES_PER_ELEMENT;
  if (buffer.byteLength !== expected) {
    throw new DataError(
      `grid has ${String(buffer.byteLength)} bytes, expected ${String(expected)}`,
    );
  }
  return { spec, values: new Float32Array(buffer) };
}

/** Flat index of the cell containing (lon, lat), or -1 outside the grid. */
export function cellIndex(spec: GridSpec, lon: number, lat: number): number {
  const ix = Math.floor((lon - spec.west) / spec.dLon);
  const iy = Math.floor((spec.north - lat) / spec.dLat);
  if (ix < 0 || ix >= spec.nx || iy < 0 || iy >= spec.ny) return -1;
  return iy * spec.nx + ix;
}

export function valueAt(grid: Grid, lon: number, lat: number): number {
  const index = cellIndex(grid.spec, lon, lat);
  return index < 0 ? Number.NaN : (grid.values[index] ?? Number.NaN);
}
