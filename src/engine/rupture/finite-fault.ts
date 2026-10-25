import { destination } from '@/lib/math/geo';
import { cumulativeLengthsKm, pointAtKm, slicePath } from '@/lib/math/polyline';
import type { LonLat, RuptureSpec } from '@/types/scenario';

import { magnitudeFromRuptureArea } from './scaling';

/**
 * Kinematic finite-fault rupture: a planar fault below the ruptured part of the trace,
 * discretized into subfaults that start radiating when a circular rupture front, spreading from
 * the hypocentre at constant velocity over the fault plane, reaches them.
 */

export interface RuptureOptions {
  ruptureVelocityKmS: number;
  /** Target subfault size along strike. */
  alongStrikeStepKm?: number;
  /** Subfault rows down dip. */
  downDipRows?: number;
}

export interface Subfaults {
  count: number;
  lon: Float64Array;
  lat: Float64Array;
  depthKm: Float64Array;
  /** Rupture-front arrival, seconds after origin. */
  timeS: Float64Array;
}

export interface Rupture {
  mw: number;
  lengthKm: number;
  widthKm: number;
  areaKm2: number;
  hypocenter: { lon: number; lat: number; depthKm: number };
  ruptureVelocityKmS: number;
  /** Top edge of the ruptured part and the front's arrival time at each of its vertices. */
  trace: LonLat[];
  traceTimesS: number[];
  /** Surface projection of the rupture plane as a closed ring, for Joyner–Boore distances. */
  surfaceProjection: LonLat[];
  subfaults: Subfaults;
  durationS: number;
}

const DEFAULT_STEP_KM = 4;
const DEFAULT_ROWS = 3;
const RAD = Math.PI / 180;

export function buildRupture(spec: RuptureSpec, options: RuptureOptions): Rupture {
  const { fault } = spec;
  const startKm = Math.min(spec.startKm, spec.endKm);
  const endKm = Math.max(spec.startKm, spec.endKm);
  const lengthKm = endKm - startKm;
  if (lengthKm <= 0) throw new RangeError('rupture length must be positive');
  if (spec.hypocenterKm < startKm || spec.hypocenterKm > endKm) {
    throw new RangeError('hypocentre must lie on the ruptured part of the trace');
  }

  const dip = fault.dipDeg * RAD;
  const seismogenicKm = fault.lowerDepthKm - fault.upperDepthKm;
  const widthKm = seismogenicKm / Math.sin(dip);
  const areaKm2 = lengthKm * widthKm;
  const mw = spec.mw ?? magnitudeFromRuptureArea(areaKm2, fault.rakeDeg);
  const hypocenterDepthKm = Math.min(
    Math.max(spec.hypocenterDepthKm, fault.upperDepthKm),
    fault.lowerDepthKm,
  );
  const velocityKmS = options.ruptureVelocityKmS;

  const cumulative = cumulativeLengthsKm(fault.trace);
  /** Position on the fault plane at `km` along the trace and `depth`. */
  const positionAt = (km: number, depth: number) => {
    const { point, bearingDeg } = pointAtKm(fault.trace, cumulative, km);
    // Right-hand rule: the fault dips towards strike + 90°.
    const horizontalKm = (depth - fault.upperDepthKm) / Math.tan(dip);
    return destination(point[0], point[1], bearingDeg + 90, horizontalKm);
  };
  /** Rupture-front arrival: distance on the fault plane from the hypocentre / velocity. */
  const frontTime = (km: number, depth: number) =>
    Math.hypot(km - spec.hypocenterKm, (depth - hypocenterDepthKm) / Math.sin(dip)) / velocityKmS;

  const columns = Math.max(1, Math.ceil(lengthKm / (options.alongStrikeStepKm ?? DEFAULT_STEP_KM)));
  const rows = options.downDipRows ?? DEFAULT_ROWS;
  // The hypocentre radiates first, at t = 0; the grid cell centres follow.
  const count = 1 + columns * rows;
  const subfaults: Subfaults = {
    count,
    lon: new Float64Array(count),
    lat: new Float64Array(count),
    depthKm: new Float64Array(count),
    timeS: new Float64Array(count),
  };
  const place = (index: number, km: number, depth: number) => {
    const [lon, lat] = positionAt(km, depth);
    subfaults.lon[index] = lon;
    subfaults.lat[index] = lat;
    subfaults.depthKm[index] = depth;
    subfaults.timeS[index] = frontTime(km, depth);
  };
  place(0, spec.hypocenterKm, hypocenterDepthKm);
  for (let column = 0; column < columns; column++) {
    const km = startKm + ((column + 0.5) / columns) * lengthKm;
    for (let row = 0; row < rows; row++) {
      place(1 + column * rows + row, km, fault.upperDepthKm + ((row + 0.5) / rows) * seismogenicKm);
    }
  }

  // The point above the hypocentre becomes a trace vertex, where the front first breaks upward.
  const sliced = slicePath(fault.trace, cumulative, startKm, endKm);
  const slicedCumulative = cumulativeLengthsKm(sliced);
  const hypocentreKm = spec.hypocenterKm - startKm;
  const insertAt = slicedCumulative.findIndex((km) => km >= hypocentreKm);
  const trace =
    insertAt > 0 && (slicedCumulative[insertAt] ?? 0) > hypocentreKm
      ? [
          ...sliced.slice(0, insertAt),
          pointAtKm(fault.trace, cumulative, spec.hypocenterKm).point,
          ...sliced.slice(insertAt),
        ]
      : sliced;
  const traceCumulative = cumulativeLengthsKm(trace);
  const traceTimesS = traceCumulative.map((km) => frontTime(startKm + km, fault.upperDepthKm));
  const bottomEdge = trace.map((_, i) =>
    positionAt(startKm + (traceCumulative[i] ?? 0), fault.lowerDepthKm),
  );
  const firstPoint = trace[0];
  const surfaceProjection: LonLat[] = [
    ...trace,
    ...bottomEdge.reverse(),
    ...(firstPoint ? [firstPoint] : []),
  ];
  const [hypoLon, hypoLat] = positionAt(spec.hypocenterKm, hypocenterDepthKm);

  return {
    mw,
    lengthKm,
    widthKm,
    areaKm2,
    hypocenter: { lon: hypoLon, lat: hypoLat, depthKm: hypocenterDepthKm },
    ruptureVelocityKmS: velocityKmS,
    trace,
    traceTimesS,
    surfaceProjection,
    subfaults,
    durationS: Math.max(
      frontTime(startKm, fault.lowerDepthKm),
      frontTime(endKm, fault.lowerDepthKm),
      frontTime(startKm, fault.upperDepthKm),
      frontTime(endKm, fault.upperDepthKm),
    ),
  };
}
