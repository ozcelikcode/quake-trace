import { LocalProjection } from '@/lib/math/geo';
import type { LonLat } from '@/types/scenario';

/**
 * Horizontal distance from a point to a polygon: zero inside, otherwise the distance to the
 * nearest edge. With the rupture's surface projection this is the Joyner–Boore distance Rjb.
 */
export class PolygonDistance {
  readonly #projection: LocalProjection;
  readonly #xs: Float64Array;
  readonly #ys: Float64Array;

  constructor(ring: readonly LonLat[], projection: LocalProjection) {
    this.#projection = projection;
    this.#xs = Float64Array.from(ring, (p) => projection.x(p[0]));
    this.#ys = Float64Array.from(ring, (p) => projection.y(p[1]));
  }

  distanceKm(lon: number, lat: number): number {
    const x = this.#projection.x(lon);
    const y = this.#projection.y(lat);
    const xs = this.#xs;
    const ys = this.#ys;
    let inside = false;
    let best = Number.POSITIVE_INFINITY;
    for (let i = 0, j = xs.length - 1; i < xs.length; j = i++) {
      const xi = xs[i] ?? 0;
      const yi = ys[i] ?? 0;
      const xj = xs[j] ?? 0;
      const yj = ys[j] ?? 0;
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;

      const dx = xj - xi;
      const dy = yj - yi;
      const lengthSq = dx * dx + dy * dy;
      const t =
        lengthSq > 0 ? Math.min(1, Math.max(0, ((x - xi) * dx + (y - yi) * dy) / lengthSq)) : 0;
      best = Math.min(best, Math.hypot(x - (xi + t * dx), y - (yi + t * dy)));
    }
    return inside ? 0 : best;
  }
}
