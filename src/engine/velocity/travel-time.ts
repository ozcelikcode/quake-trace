import { layerIndexAt, velocity, type VelocityLayer, type Wave } from './layered-model';

/**
 * First-arrival travel times in a flat layered model for a source at depth and a receiver at the
 * surface: the direct wave (ray-parameter solution through the layers above the source) and the
 * head waves along every deeper interface (e.g. Lay and Wallace, 1995, Modern Global Seismology,
 * §3.4). The first arrival is the minimum of these.
 */

const BISECTION_STEPS = 60;

interface Leg {
  thicknessKm: number;
  velocityKmS: number;
}

/** Layers crossed by an up-going ray from the source to the surface. */
function legsAbove(model: readonly VelocityLayer[], wave: Wave, depthKm: number): Leg[] {
  const legs: Leg[] = [];
  const sourceLayer = layerIndexAt(model, depthKm);
  for (let i = 0; i <= sourceLayer; i++) {
    const layer = model[i];
    if (!layer) break;
    const bottom = Math.min(model[i + 1]?.topKm ?? Number.POSITIVE_INFINITY, depthKm);
    const thicknessKm = bottom - layer.topKm;
    if (thicknessKm > 0) legs.push({ thicknessKm, velocityKmS: velocity(layer, wave) });
  }
  return legs;
}

export function directTravelTime(
  model: readonly VelocityLayer[],
  wave: Wave,
  distanceKm: number,
  depthKm: number,
): number {
  const top = model[0];
  if (!top) throw new RangeError('the velocity model has no layers');
  const legs = legsAbove(model, wave, depthKm);
  // A surface source: the wave travels along the top layer.
  if (legs.length === 0) return distanceKm / velocity(top, wave);
  const [only] = legs;
  if (legs.length === 1 && only) {
    return Math.hypot(distanceKm, only.thicknessKm) / only.velocityKmS;
  }

  // Solve x(p) = Σ h·p·v / √(1 − p²v²) = distance for the ray parameter p by bisection.
  const maxVelocity = Math.max(...legs.map((leg) => leg.velocityKmS));
  const offset = (p: number) =>
    legs.reduce((sum, leg) => {
      const pv = p * leg.velocityKmS;
      return sum + (leg.thicknessKm * pv) / Math.sqrt(1 - pv * pv);
    }, 0);
  let low = 0;
  let high = 1 / maxVelocity;
  for (let step = 0; step < BISECTION_STEPS; step++) {
    const mid = (low + high) / 2;
    if (offset(mid) < distanceKm) low = mid;
    else high = mid;
  }
  const p = (low + high) / 2;
  return legs.reduce((sum, leg) => {
    const pv = p * leg.velocityKmS;
    return sum + leg.thicknessKm / (leg.velocityKmS * Math.sqrt(1 - pv * pv));
  }, 0);
}

/**
 * Head wave along the top of layer `refractor`: t = x/vₙ + Σ (2dᵢ − sᵢ)·√(1/vᵢ² − 1/vₙ²), where dᵢ
 * is the thickness of each layer above the refractor and sᵢ the part of it above the source.
 * Returns Infinity where the head wave does not exist (refractor above the source, a slower
 * refractor, or a distance shorter than the critical distance).
 */
export function headWaveTravelTime(
  model: readonly VelocityLayer[],
  wave: Wave,
  distanceKm: number,
  depthKm: number,
  refractor: number,
): number {
  const refractorLayer = model[refractor];
  if (!refractorLayer || refractorLayer.topKm <= depthKm) return Number.POSITIVE_INFINITY;
  const vn = velocity(refractorLayer, wave);

  let delay = 0;
  let criticalKm = 0;
  for (let i = 0; i < refractor; i++) {
    const layer = model[i];
    if (!layer) return Number.POSITIVE_INFINITY;
    const vi = velocity(layer, wave);
    if (vi >= vn) return Number.POSITIVE_INFINITY;
    const bottom = model[i + 1]?.topKm ?? refractorLayer.topKm;
    const thickness = bottom - layer.topKm;
    const aboveSource = Math.min(thickness, Math.max(0, depthKm - layer.topKm));
    const path = 2 * thickness - aboveSource;
    const cosine = Math.sqrt(1 - (vi / vn) ** 2);
    delay += path * (cosine / vi);
    criticalKm += path * (vi / vn / cosine);
  }
  if (distanceKm < criticalKm) return Number.POSITIVE_INFINITY;
  return distanceKm / vn + delay;
}

export function firstArrivalTime(
  model: readonly VelocityLayer[],
  wave: Wave,
  distanceKm: number,
  depthKm: number,
): number {
  let best = directTravelTime(model, wave, distanceKm, depthKm);
  for (let refractor = 1; refractor < model.length; refractor++) {
    best = Math.min(best, headWaveTravelTime(model, wave, distanceKm, depthKm, refractor));
  }
  return best;
}

/**
 * First-arrival times tabulated against distance for one source depth, with linear
 * interpolation; this keeps the cell-by-subfault loop of a scenario cheap.
 */
export class TravelTimeCurve {
  readonly #times: Float64Array;
  readonly #stepKm: number;

  constructor(
    model: readonly VelocityLayer[],
    wave: Wave,
    depthKm: number,
    maxDistanceKm: number,
    stepKm = 1,
  ) {
    const count = Math.ceil(maxDistanceKm / stepKm) + 2;
    this.#stepKm = stepKm;
    this.#times = new Float64Array(count);
    for (let i = 0; i < count; i++) {
      this.#times[i] = firstArrivalTime(model, wave, i * stepKm, depthKm);
    }
  }

  time(distanceKm: number): number {
    const position = distanceKm / this.#stepKm;
    const index = Math.min(Math.floor(position), this.#times.length - 2);
    const fraction = position - index;
    const a = this.#times[index] ?? Number.NaN;
    const b = this.#times[index + 1] ?? a;
    return a + fraction * (b - a);
  }
}
