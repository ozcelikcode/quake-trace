import { EARTH_RADIUS_KM, unitVector } from '@/lib/math/geo';

import type { Rupture } from '../rupture/finite-fault';
import type { VelocityLayer } from '../velocity/layered-model';
import { TravelTimeCurve } from '../velocity/travel-time';

/**
 * First P and S arrivals from a finite rupture at surface points: the minimum over subfaults of
 * (rupture-front time + first-arrival travel time at the chord distance). `locate` writes its
 * results into fields instead of returning objects, because it runs for every grid cell.
 */
export class RuptureArrivals {
  pArrivalS = Number.POSITIVE_INFINITY;
  sArrivalS = Number.POSITIVE_INFINITY;
  readonly #rupture: Rupture;
  readonly #pCurves: TravelTimeCurve[] = [];
  readonly #sCurves: TravelTimeCurve[] = [];
  readonly #subfaultVectors: Float64Array;
  readonly #point = new Float64Array(3);
  #pSubfault = -1;
  #pDistanceKm = Number.NaN;

  constructor(rupture: Rupture, model: readonly VelocityLayer[], maxDistanceKm: number) {
    this.#rupture = rupture;
    const { subfaults } = rupture;
    // One travel-time curve per distinct subfault depth.
    const curves = new Map<number, { p: TravelTimeCurve; s: TravelTimeCurve }>();
    this.#subfaultVectors = new Float64Array(subfaults.count * 3);
    for (let j = 0; j < subfaults.count; j++) {
      const depth = subfaults.depthKm[j] ?? 0;
      let pair = curves.get(depth);
      if (!pair) {
        pair = {
          p: new TravelTimeCurve(model, 'P', depth, maxDistanceKm),
          s: new TravelTimeCurve(model, 'S', depth, maxDistanceKm),
        };
        curves.set(depth, pair);
      }
      this.#pCurves.push(pair.p);
      this.#sCurves.push(pair.s);
      unitVector(subfaults.lon[j] ?? 0, subfaults.lat[j] ?? 0, this.#subfaultVectors, j * 3);
    }
  }

  /** Surface (chord) distance from the last located point to subfault j, km. */
  #chordKm(j: number): number {
    const vectors = this.#subfaultVectors;
    const dx = (this.#point[0] ?? 0) - (vectors[j * 3] ?? 0);
    const dy = (this.#point[1] ?? 0) - (vectors[j * 3 + 1] ?? 0);
    const dz = (this.#point[2] ?? 0) - (vectors[j * 3 + 2] ?? 0);
    // Within 700 km the chord differs from the arc by less than 0.1 %.
    return EARTH_RADIUS_KM * Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  locate(lon: number, lat: number): void {
    unitVector(lon, lat, this.#point, 0);
    const { subfaults } = this.#rupture;
    let bestP = Number.POSITIVE_INFINITY;
    let bestS = Number.POSITIVE_INFINITY;
    let pSubfault = -1;
    let pDistance = Number.NaN;
    for (let j = 0; j < subfaults.count; j++) {
      const distanceKm = this.#chordKm(j);
      const start = subfaults.timeS[j] ?? 0;
      const p = start + (this.#pCurves[j]?.time(distanceKm) ?? Number.POSITIVE_INFINITY);
      const s = start + (this.#sCurves[j]?.time(distanceKm) ?? Number.POSITIVE_INFINITY);
      if (p < bestP) {
        bestP = p;
        pSubfault = j;
        pDistance = distanceKm;
      }
      if (s < bestS) bestS = s;
    }
    this.pArrivalS = bestP;
    this.sArrivalS = bestS;
    this.#pSubfault = pSubfault;
    this.#pDistanceKm = pDistance;
  }

  /** Horizontal slowness dT/dΔ (s/km) of the first P arrival at the last located point. */
  pSlownessSKm(): number {
    const curve = this.#pCurves[this.#pSubfault];
    if (!curve) return Number.NaN;
    const d = Math.max(0.5, this.#pDistanceKm);
    return curve.time(d + 0.5) - curve.time(d - 0.5);
  }

  /** Distance from the last located point to the nearest subfault, an estimate of Rrup, km. */
  ruptureDistanceKm(): number {
    const { subfaults } = this.#rupture;
    let best = Number.POSITIVE_INFINITY;
    for (let j = 0; j < subfaults.count; j++) {
      best = Math.min(best, Math.hypot(this.#chordKm(j), subfaults.depthKm[j] ?? 0));
    }
    return best;
  }
}
