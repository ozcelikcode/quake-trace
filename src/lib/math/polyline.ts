import type { LonLat } from '@/types/scenario';

import { bearingDeg, haversineKm } from './geo';

/** Distance along a lon/lat polyline. Segments are short (a few km), so linear interpolation suffices. */

export function cumulativeLengthsKm(path: readonly LonLat[]): number[] {
  const lengths = [0];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    if (!a || !b) break;
    lengths.push((lengths[i - 1] ?? 0) + haversineKm(a[0], a[1], b[0], b[1]));
  }
  return lengths;
}

function segmentAt(cumulative: readonly number[], km: number): number {
  let segment = 0;
  while (segment < cumulative.length - 2 && (cumulative[segment + 1] ?? 0) < km) segment++;
  return segment;
}

export interface PathPoint {
  point: [number, number];
  /** Local direction of the path at this point, degrees clockwise from north. */
  bearingDeg: number;
}

/** Point at `km` along the path (clamped to its ends). */
export function pointAtKm(
  path: readonly LonLat[],
  cumulative: readonly number[],
  km: number,
): PathPoint {
  const segment = segmentAt(cumulative, km);
  const a = path[segment];
  const b = path[segment + 1];
  if (!a || !b) throw new RangeError('a path needs at least two points');
  const start = cumulative[segment] ?? 0;
  const length = (cumulative[segment + 1] ?? start) - start;
  const f = length > 0 ? Math.min(1, Math.max(0, (km - start) / length)) : 0;
  return {
    point: [a[0] + f * (b[0] - a[0]), a[1] + f * (b[1] - a[1])],
    bearingDeg: bearingDeg(a[0], a[1], b[0], b[1]),
  };
}

/** The part of the path between `fromKm` and `toKm`, with interpolated end points. */
export function slicePath(
  path: readonly LonLat[],
  cumulative: readonly number[],
  fromKm: number,
  toKm: number,
): LonLat[] {
  const out: LonLat[] = [pointAtKm(path, cumulative, fromKm).point];
  for (let i = 1; i < path.length - 1; i++) {
    const km = cumulative[i] ?? 0;
    const vertex = path[i];
    if (vertex && km > fromKm && km < toKm) out.push(vertex);
  }
  out.push(pointAtKm(path, cumulative, toKm).point);
  return out;
}

/** Distance along the path where it first crosses longitude `lon`, if it does. */
export function kmAtLongitude(
  path: readonly LonLat[],
  cumulative: readonly number[],
  lon: number,
): number | undefined {
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    if (!a || !b) break;
    const crosses = (a[0] - lon) * (b[0] - lon) <= 0 && a[0] !== b[0];
    if (crosses) {
      const f = (lon - a[0]) / (b[0] - a[0]);
      const start = cumulative[i - 1] ?? 0;
      return start + f * ((cumulative[i] ?? start) - start);
    }
  }
  return undefined;
}
