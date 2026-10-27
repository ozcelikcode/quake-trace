import { destination, haversineKm } from '@/lib/math/geo';
import { cumulativeLengthsKm, pointAtKm } from '@/lib/math/polyline';
import type { Scenario } from '@/types/scenario';
import type { StationSite } from '@/types/simulation';

/** FDSN-style network code of the virtual stations; no real network uses it. */
export const VIRTUAL_NETWORK = 'VS';
/** Real accelerometers within this distance of the epicentre make virtual ones unnecessary. */
const COVERAGE_KM = 150;
/** Real stations farther than this record nothing worth showing (and lie off the event grid). */
const MAX_STATION_KM = 1000;
const MIN_REAL_STATIONS = 8;
/** Twelve sites on three rings, alternating 20, 50 and 100 km, every 30°. */
const RING_KM = [20, 50, 100];
const BEARING_STEP_DEG = 30;

export function isVirtualStation(id: string): boolean {
  return id.startsWith(`${VIRTUAL_NETWORK}.`);
}

/** Epicentre of a scenario: the hypocentre's point on the fault trace. */
export function scenarioEpicentre(scenario: Scenario): [number, number] {
  const { trace } = scenario.rupture.fault;
  return pointAtKm(trace, cumulativeLengthsKm(trace), scenario.rupture.hypocenterKm).point;
}

/**
 * Recording sites for a scenario: the real accelerometers within 1000 km, plus a ring of virtual stations
 * around the epicentre where fewer than eight real ones lie within 150 km (outside the regional
 * network). Virtual stations make the telemetry and the early-warning model work anywhere; the
 * interface labels them as virtual.
 */
export function recordingSites(scenario: Scenario, real: readonly StationSite[]): StationSite[] {
  const [lon, lat] = scenarioEpicentre(scenario);
  const distanceKm = (site: StationSite) => haversineKm(lon, lat, site.lon, site.lat);
  const reachable = real.filter((site) => distanceKm(site) <= MAX_STATION_KM);
  const nearby = reachable.filter((site) => distanceKm(site) <= COVERAGE_KM);
  if (nearby.length >= MIN_REAL_STATIONS) return reachable;
  const virtual: StationSite[] = [];
  for (let i = 0; i * BEARING_STEP_DEG < 360; i++) {
    const [siteLon, siteLat] = destination(
      lon,
      lat,
      i * BEARING_STEP_DEG,
      RING_KM[i % RING_KM.length] ?? 50,
    );
    virtual.push({
      id: `${VIRTUAL_NETWORK}.V${String(i + 1).padStart(2, '0')}`,
      lon: siteLon,
      lat: siteLat,
    });
  }
  return [...reachable, ...virtual];
}
