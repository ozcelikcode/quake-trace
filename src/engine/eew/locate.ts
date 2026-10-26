import { haversineKm } from '@/lib/math/geo';

import type { TravelTimeCurve } from '../velocity/travel-time';

export interface Pick {
  lon: number;
  lat: number;
  timeS: number;
}

export interface GridLocation {
  lon: number;
  lat: number;
  originS: number;
  /** Root-mean-square travel-time residual, s. */
  rmsS: number;
}

export interface GridSearchOptions {
  /** Candidate spacing in degrees. */
  stepDeg: number;
  /** Search area around the picked stations, degrees. */
  marginDeg: number;
}

/**
 * Epicentre by grid search over candidate points at the depth of the P travel-time curve,
 * minimizing the squared residuals of the picks. For a least-squares misfit the best origin time
 * at a candidate is the mean of (pick − travel time), so only position is searched.
 */
export function locateByGridSearch(
  picks: readonly Pick[],
  curve: TravelTimeCurve,
  options: GridSearchOptions,
): GridLocation {
  if (picks.length === 0) throw new RangeError('at least one pick is needed');
  const lons = picks.map((pick) => pick.lon);
  const lats = picks.map((pick) => pick.lat);
  const west = Math.min(...lons) - options.marginDeg;
  const east = Math.max(...lons) + options.marginDeg;
  const south = Math.min(...lats) - options.marginDeg;
  const north = Math.max(...lats) + options.marginDeg;
  const residuals = new Float64Array(picks.length);

  let best: GridLocation = { lon: Number.NaN, lat: Number.NaN, originS: 0, rmsS: Infinity };
  for (let lat = south; lat <= north + 1e-9; lat += options.stepDeg) {
    for (let lon = west; lon <= east + 1e-9; lon += options.stepDeg) {
      let mean = 0;
      picks.forEach((pick, i) => {
        const residual = pick.timeS - curve.time(haversineKm(lon, lat, pick.lon, pick.lat));
        residuals[i] = residual;
        mean += residual;
      });
      mean /= picks.length;
      let squares = 0;
      for (const residual of residuals) squares += (residual - mean) ** 2;
      const rmsS = Math.sqrt(squares / picks.length);
      if (rmsS < best.rmsS) best = { lon, lat, originS: mean, rmsS };
    }
  }
  return best;
}
