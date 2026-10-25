/** Spherical-earth helpers. Distances in km, angles in degrees, positions as (lon, lat). */

/** Mean Earth radius (IUGG). */
export const EARTH_RADIUS_KM = 6371.0088;

const RAD = Math.PI / 180;

export function haversineKm(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const dLat = (lat2 - lat1) * RAD;
  const dLon = (lon2 - lon1) * RAD;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Initial great-circle bearing from point 1 to point 2, degrees clockwise from north. */
export function bearingDeg(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const phi1 = lat1 * RAD;
  const phi2 = lat2 * RAD;
  const dLon = (lon2 - lon1) * RAD;
  const y = Math.sin(dLon) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLon);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}

/** Point reached by travelling `distanceKm` from (lon, lat) along `bearing` on a great circle. */
export function destination(
  lon: number,
  lat: number,
  bearing: number,
  distanceKm: number,
): [number, number] {
  const delta = distanceKm / EARTH_RADIUS_KM;
  const theta = bearing * RAD;
  const phi1 = lat * RAD;
  const lambda1 = lon * RAD;
  const phi2 = Math.asin(
    Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(theta),
  );
  const lambda2 =
    lambda1 +
    Math.atan2(
      Math.sin(theta) * Math.sin(delta) * Math.cos(phi1),
      Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2),
    );
  return [lambda2 / RAD, phi2 / RAD];
}

/** Unit vector of a point on the sphere, written into `out` at `offset` (x, y, z). */
export function unitVector(lon: number, lat: number, out: Float64Array, offset: number): void {
  const phi = lat * RAD;
  const lambda = lon * RAD;
  out[offset] = Math.cos(phi) * Math.cos(lambda);
  out[offset + 1] = Math.cos(phi) * Math.sin(lambda);
  out[offset + 2] = Math.sin(phi);
}

/**
 * Equirectangular projection centred on (lon0, lat0), in km. Within a few hundred km of the
 * centre its distance error stays below about 1 %, enough for source-to-site distances in GMPEs.
 */
export class LocalProjection {
  readonly #lon0: number;
  readonly #lat0: number;
  readonly #kmPerDegLon: number;
  readonly #kmPerDegLat = EARTH_RADIUS_KM * RAD;

  constructor(lon0: number, lat0: number) {
    this.#lon0 = lon0;
    this.#lat0 = lat0;
    this.#kmPerDegLon = EARTH_RADIUS_KM * RAD * Math.cos(lat0 * RAD);
  }

  x(lon: number): number {
    return (lon - this.#lon0) * this.#kmPerDegLon;
  }

  y(lat: number): number {
    return (lat - this.#lat0) * this.#kmPerDegLat;
  }
}
