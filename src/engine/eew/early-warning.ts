import { haversineKm } from '@/lib/math/geo';
import type { EarlyWarning, StationRecord } from '@/types/simulation';

import { createRandom, deriveSeed } from '../random/random';
import type { Rupture } from '../rupture/finite-fault';
import { magnitudeFromRuptureArea } from '../rupture/scaling';
import type { VelocityLayer } from '../velocity/layered-model';
import { TravelTimeCurve } from '../velocity/travel-time';
import { locateByGridSearch } from './locate';

/**
 * Network early warning from the station triggers, in the spirit of ElarmS (Allen and Kanamori,
 * 2003): a few triggered stations locate the event, their initial P amplitudes give a magnitude,
 * and the alert follows.
 *
 * 1. Location: grid search on the first four STA/LTA triggers, depth fixed at 10 km.
 * 2. Pd, the peak displacement in the first 3 s of P (Wu et al., 2007), is modelled rather than
 *    measured: the point-source synthetic records radiate the whole moment from their first
 *    second, while real early P waves only see the rupture grown so far, which is why Pd
 *    saturates for large events. The rupture grown in 3 s is a disc of radius Vr·3 s, cut to
 *    the fault width when wider; its area gives an effective magnitude (Wells and Coppersmith,
 *    1994, capped at Mw). Pd follows from Wu and Zhao (2006, Geophys. Res. Lett. 33, L16312):
 *    log Pd = −3.463 + 0.729·M − 1.374·log R (Pd cm, R hypocentral km), with their scatter of
 *    0.305 drawn per station from the scenario seed.
 * 3. Magnitude: the same relation inverted at each station's estimated hypocentral distance,
 *    averaged.
 * 4. Alert: when the last of the four stations has 3 s of P wave. Telemetry and processing
 *    latency are not modelled.
 */
const EEW_STATIONS = 4;
const EEW_DEPTH_KM = 10;
const PD_WINDOW_S = 3;
const PD_SCATTER_LOG10 = 0.305;
const SEARCH = { stepDeg: 0.01, marginDeg: 0.5 };
const MAX_DISTANCE_KM = 400;

export function pdFromMagnitude(magnitude: number, hypocentralKm: number): number {
  return 10 ** (-3.463 + 0.729 * magnitude - 1.374 * Math.log10(hypocentralKm));
}

export function pdMagnitude(pdCm: number, hypocentralKm: number): number {
  return (Math.log10(pdCm) + 3.463 + 1.374 * Math.log10(hypocentralKm)) / 0.729;
}

/** Magnitude of the rupture grown within `timeS` of the origin. */
export function grownMagnitude(rupture: Rupture, rakeDeg: number, timeS: number): number {
  const radiusKm = rupture.ruptureVelocityKmS * timeS;
  const areaKm2 =
    2 * radiusKm <= rupture.widthKm
      ? Math.PI * radiusKm * radiusKm
      : rupture.widthKm * 2 * radiusKm;
  if (areaKm2 >= rupture.areaKm2) return rupture.mw;
  return Math.min(rupture.mw, magnitudeFromRuptureArea(areaKm2, rakeDeg));
}

export interface EarlyWarningInput {
  stations: readonly StationRecord[];
  rupture: Rupture;
  rakeDeg: number;
  model: readonly VelocityLayer[];
  seed: number;
}

export function earlyWarning(input: EarlyWarningInput): EarlyWarning | null {
  const { rupture } = input;
  const triggered = input.stations
    .filter((station) => station.triggerS !== null)
    .sort((a, b) => (a.triggerS ?? 0) - (b.triggerS ?? 0))
    .slice(0, EEW_STATIONS);
  const last = triggered.at(-1)?.triggerS;
  if (triggered.length < EEW_STATIONS || last === null || last === undefined) return null;

  const curve = new TravelTimeCurve(input.model, 'P', EEW_DEPTH_KM, MAX_DISTANCE_KM);
  const location = locateByGridSearch(
    triggered.map((station) => ({
      lon: station.lon,
      lat: station.lat,
      timeS: station.triggerS ?? 0,
    })),
    curve,
    SEARCH,
  );

  const { hypocenter } = rupture;
  const effective = grownMagnitude(rupture, input.rakeDeg, PD_WINDOW_S);
  const stations = triggered.map((station) => {
    const trueKm = Math.hypot(
      haversineKm(hypocenter.lon, hypocenter.lat, station.lon, station.lat),
      hypocenter.depthKm,
    );
    const random = createRandom(deriveSeed(input.seed, `pd:${station.id}`));
    const pdCm = pdFromMagnitude(effective, trueKm) * 10 ** (PD_SCATTER_LOG10 * random.normal());
    const estimatedKm = Math.hypot(
      haversineKm(location.lon, location.lat, station.lon, station.lat),
      EEW_DEPTH_KM,
    );
    return { id: station.id, pdCm, magnitude: pdMagnitude(pdCm, estimatedKm) };
  });

  return {
    firstTriggerS: triggered[0]?.triggerS ?? last,
    alertS: last + PD_WINDOW_S,
    epicenter: { lon: location.lon, lat: location.lat },
    depthKm: EEW_DEPTH_KM,
    originS: location.originS,
    stations,
    magnitude: stations.reduce((sum, station) => sum + station.magnitude, 0) / stations.length,
    locationErrorKm: haversineKm(location.lon, location.lat, hypocenter.lon, hypocenter.lat),
  };
}
