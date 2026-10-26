import { destination } from '@/lib/math/geo';
import { cumulativeLengthsKm, pointAtKm } from '@/lib/math/polyline';
import type { AftershockCatalog } from '@/types/aftershocks';
import type { LonLat } from '@/types/scenario';

import type { Random } from '../random/random';
import {
  exceedanceProbability,
  expectedCount,
  GENERIC_CALIFORNIA,
  sampleMagnitude,
  sampleTimeDays,
  SECONDS_PER_DAY,
  type SequenceParameters,
} from './reasenberg-jones';

/**
 * A synthetic aftershock catalog for the first three days: the count is drawn from a Poisson
 * distribution with the Reasenberg–Jones expected number, times from the modified Omori law and
 * magnitudes from Gutenberg–Richter (`reasenberg-jones.ts`). Locations follow the rupture:
 * uniform along the ruptured trace and across the surface projection of the fault plane, with
 * Gaussian scatter of `SCATTER_KM` (an assumption standing in for the spatial kernel of ETAS),
 * at a uniform depth within the seismogenic layer.
 */

export const AFTERSHOCK_DURATION_S = 3 * SECONDS_PER_DAY;
/** Smallest catalogued magnitude; smaller shocks are not shown. */
export const MIN_MAGNITUDE = 3;
const SCATTER_KM = 5;
const FORECAST_STEP_S = 3600;
const FORECAST_WINDOW_DAYS = 1;
/** Above this mean the Poisson count uses its normal approximation. */
const POISSON_NORMAL_FROM = 50;
const RAD = Math.PI / 180;

export interface CatalogRupture {
  mw: number;
  /** Upper edge of the ruptured part. */
  trace: readonly LonLat[];
  dipDeg: number;
  upperDepthKm: number;
  lowerDepthKm: number;
}

export function samplePoisson(random: Random, mean: number): number {
  if (mean <= 0) return 0;
  if (mean > POISSON_NORMAL_FROM) {
    return Math.max(0, Math.round(mean + Math.sqrt(mean) * random.normal()));
  }
  // Knuth's multiplication method.
  const limit = Math.exp(-mean);
  let count = 0;
  for (let product = random.next(); product > limit; product *= random.next()) count++;
  return count;
}

export function aftershockCatalog(
  rupture: CatalogRupture,
  random: Random,
  parameters: SequenceParameters = GENERIC_CALIFORNIA,
  durationS = AFTERSHOCK_DURATION_S,
): AftershockCatalog {
  const durationDays = durationS / SECONDS_PER_DAY;
  const count = samplePoisson(
    random,
    expectedCount(rupture.mw, MIN_MAGNITUDE, 0, durationDays, parameters),
  );

  const cumulative = cumulativeLengthsKm(rupture.trace);
  const lengthKm = cumulative.at(-1) ?? 0;
  const dip = rupture.dipDeg * RAD;
  const projectionKm = (rupture.lowerDepthKm - rupture.upperDepthKm) / Math.tan(dip);

  const events = Array.from({ length: count }, () => {
    const timeS = sampleTimeDays(random.next(), durationDays, parameters) * SECONDS_PER_DAY;
    const magnitude = sampleMagnitude(random.next(), MIN_MAGNITUDE, rupture.mw, parameters.b);
    const { point, bearingDeg } = pointAtKm(rupture.trace, cumulative, random.next() * lengthKm);
    const acrossKm = random.next() * projectionKm + SCATTER_KM * random.normal();
    const alongKm = SCATTER_KM * random.normal();
    const [lon1, lat1] = destination(point[0], point[1], bearingDeg + 90, acrossKm);
    const [lon, lat] = destination(lon1, lat1, bearingDeg, alongKm);
    const depthKm =
      rupture.upperDepthKm + random.next() * (rupture.lowerDepthKm - rupture.upperDepthKm);
    return { timeS, magnitude, lon, lat, depthKm };
  }).sort((x, y) => x.timeS - y.timeS);

  const hours = Math.floor(durationS / FORECAST_STEP_S) + 1;
  const forecast = (magnitude: number) =>
    Float32Array.from({ length: hours }, (_, hour) => {
      const t = (hour * FORECAST_STEP_S) / SECONDS_PER_DAY;
      return exceedanceProbability(rupture.mw, magnitude, t, t + FORECAST_WINDOW_DAYS, parameters);
    });

  return {
    durationS,
    minMagnitude: MIN_MAGNITUDE,
    count,
    timeS: Float32Array.from(events, (e) => e.timeS),
    lon: Float32Array.from(events, (e) => e.lon),
    lat: Float32Array.from(events, (e) => e.lat),
    depthKm: Float32Array.from(events, (e) => e.depthKm),
    magnitude: Float32Array.from(events, (e) => e.magnitude),
    forecastStepS: FORECAST_STEP_S,
    forecastM5: forecast(5),
    forecastM6: forecast(6),
  };
}
