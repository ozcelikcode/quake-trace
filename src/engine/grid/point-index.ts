import { cellIndex } from '@/lib/math/grid';
import type { GridSpec } from '@/types/grid';

const RAD = Math.PI / 180;

/**
 * Points bucketed by grid cell (compressed sparse row), for nearest-point queries on the
 * regional grid. Distances are planar with longitude scaled by cos(latitude), exact enough at
 * the few-kilometre range of the queries.
 */
export class PointIndex {
  readonly #spec: GridSpec;
  readonly #lonLat: Float32Array;
  readonly #start: Int32Array;
  readonly #bucket: Int32Array;
  /** Grid cell of each point, -1 outside the grid. */
  readonly pointCell: Int32Array;

  constructor(spec: GridSpec, lonLat: Float32Array) {
    this.#spec = spec;
    this.#lonLat = lonLat;
    const cellCount = spec.nx * spec.ny;
    const count = lonLat.length / 2;
    const pointCell = new Int32Array(count);
    const start = new Int32Array(cellCount + 1);
    for (let point = 0; point < count; point++) {
      const cell = cellIndex(spec, lonLat[2 * point] ?? 0, lonLat[2 * point + 1] ?? 0);
      pointCell[point] = cell;
      if (cell >= 0) start[cell + 1] = (start[cell + 1] ?? 0) + 1;
    }
    for (let cell = 0; cell < cellCount; cell++) {
      start[cell + 1] = (start[cell + 1] ?? 0) + (start[cell] ?? 0);
    }
    const fill = start.slice(0, cellCount);
    const bucket = new Int32Array(count);
    for (let point = 0; point < count; point++) {
      const cell = pointCell[point] ?? -1;
      if (cell < 0) continue;
      bucket[fill[cell] ?? 0] = point;
      fill[cell] = (fill[cell] ?? 0) + 1;
    }
    this.#start = start;
    this.#bucket = bucket;
    this.pointCell = pointCell;
  }

  /** Number of points in a cell. */
  countIn(cell: number): number {
    return (this.#start[cell + 1] ?? 0) - (this.#start[cell] ?? 0);
  }

  /** The points of a cell. */
  *pointsIn(cell: number): Generator<number> {
    for (let k = this.#start[cell] ?? 0; k < (this.#start[cell + 1] ?? 0); k++) {
      yield this.#bucket[k] ?? 0;
    }
  }

  /**
   * Nearest point to (lon, lat) within `maxRing` cells that `accept` allows, or -1. Square
   * rings of cells are searched outwards until the next ring cannot hold a closer point.
   */
  nearest(
    lon: number,
    lat: number,
    maxRing: number,
    accept: (point: number) => boolean = () => true,
  ): number {
    const spec = this.#spec;
    const col = Math.floor((lon - spec.west) / spec.dLon);
    const row = Math.floor((spec.north - lat) / spec.dLat);
    const lonScale = Math.cos(lat * RAD);
    // Every point in ring r is at least r − 1 cell sides away.
    const side = Math.min(spec.dLon * lonScale, spec.dLat);
    let best = -1;
    let bestD2 = Number.POSITIVE_INFINITY;
    for (let ring = 0; ring <= maxRing && ((ring - 1) * side) ** 2 < bestD2; ring++) {
      for (let r = row - ring; r <= row + ring; r++) {
        if (r < 0 || r >= spec.ny) continue;
        const edgeRow = r === row - ring || r === row + ring;
        for (let c = col - ring; c <= col + ring; c += edgeRow || ring === 0 ? 1 : 2 * ring) {
          if (c < 0 || c >= spec.nx) continue;
          const cell = r * spec.nx + c;
          for (let k = this.#start[cell] ?? 0; k < (this.#start[cell + 1] ?? 0); k++) {
            const point = this.#bucket[k] ?? 0;
            if (!accept(point)) continue;
            const dx = ((this.#lonLat[2 * point] ?? 0) - lon) * lonScale;
            const dy = (this.#lonLat[2 * point + 1] ?? 0) - lat;
            const d2 = dx * dx + dy * dy;
            if (d2 < bestD2) {
              best = point;
              bestD2 = d2;
            }
          }
        }
      }
    }
    return best;
  }
}
