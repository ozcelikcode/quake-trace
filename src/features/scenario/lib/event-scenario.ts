import { faultSource } from '@/data/fault-source';
import type { Faults } from '@/data/schemas';
import { destination } from '@/lib/math/geo';
import { cumulativeLengthsKm, kmAtLongitude, nearestOnPath, pointAtKm } from '@/lib/math/polyline';
import type { FaultSource, Scenario, ScenarioEvent } from '@/types/scenario';

import { PresetError } from './presets';

/** Same seed as the presets, so a replay always reproduces. */
const EVENT_SEED = 1;
/**
 * Epicentres farther than this from every mapped trace rupture where they are (an assumption:
 * about twice the location error of regional catalogs; the 2019 Silivri USGS epicentre lies
 * 9.7 km from the EFSM20 trace it ruptured).
 */
export const ON_FAULT_KM = 15;
/** Half-length of the straight trace through an off-fault epicentre, km. */
const OFF_FAULT_HALF_LENGTH_KM = 60;

/** Where the rupture was placed: on the nearest mapped fault, or at the epicentre. */
export type EventPlacement = 'fault' | 'epicentre';

export interface EventScenario {
  scenario: Scenario;
  /** The nearest mapped fault (the rupture's fault, or the source of its geometry). */
  faultId: string;
  faultDistanceKm: number;
  placement: EventPlacement;
}

/**
 * A straight trace through the epicentre with the strike, dip, rake and seismogenic depths of the
 * nearest fault at its closest point: background seismicity in the same tectonic setting.
 */
function epicentreSource(event: ScenarioEvent, fault: FaultSource, nearestKm: number): FaultSource {
  const { bearingDeg } = pointAtKm(fault.trace, cumulativeLengthsKm(fault.trace), nearestKm);
  return {
    ...fault,
    id: `${fault.id}@${event.id}`,
    trace: [
      destination(event.lon, event.lat, bearingDeg + 180, OFF_FAULT_HALF_LENGTH_KM),
      destination(event.lon, event.lat, bearingDeg, OFF_FAULT_HALF_LENGTH_KM),
    ],
  };
}

/**
 * Places a real earthquake on the nearest EFSM20 fault: the hypocentre at the point of the trace
 * nearest the epicentre, at the catalog depth (clamped to the seismogenic layer by the engine),
 * with the catalog magnitude. The rupture spans the given extent or, by default, the Wells and
 * Coppersmith (1994) median area centred on the hypocentre (`engine/rupture`). An epicentre more
 * than `ON_FAULT_KM` from every trace ruptures where it is, on a trace parallel to the nearest
 * fault (`epicentreSource`); the distance to that fault is reported either way.
 */
export function scenarioFromEvent(event: ScenarioEvent, faults: Faults): EventScenario {
  let best: { id: string; km: number; distanceKm: number } | undefined;
  for (const feature of faults.features) {
    const fault = faultSource(faults, feature.properties.id);
    const near = nearestOnPath(fault.trace, event.lon, event.lat);
    if (!best || near.distanceKm < best.distanceKm) {
      best = { id: fault.id, ...near };
    }
  }
  if (!best) throw new PresetError('the faults dataset is empty');
  const nearest = faultSource(faults, best.id);

  if (best.distanceKm > ON_FAULT_KM && !event.extentLon) {
    return {
      scenario: {
        id: event.id,
        rupture: {
          fault: epicentreSource(event, nearest, best.km),
          hypocenterKm: OFF_FAULT_HALF_LENGTH_KM,
          hypocenterDepthKm: event.depthKm,
          mw: event.magnitude,
        },
        seed: EVENT_SEED,
      },
      faultId: nearest.id,
      faultDistanceKm: best.distanceKm,
      placement: 'epicentre',
    };
  }

  let extent: { startKm: number; endKm: number } | undefined;
  if (event.extentLon) {
    const cumulative = cumulativeLengthsKm(nearest.trace);
    const [from, to] = event.extentLon.map((lon) => kmAtLongitude(nearest.trace, cumulative, lon));
    if (from === undefined || to === undefined) {
      throw new PresetError(`fault ${nearest.id} does not span the extent of ${event.id}`);
    }
    extent = { startKm: Math.min(from, to), endKm: Math.max(from, to) };
  }

  return {
    scenario: {
      id: event.id,
      rupture: {
        fault: nearest,
        ...extent,
        hypocenterKm: best.km,
        hypocenterDepthKm: event.depthKm,
        mw: event.magnitude,
      },
      seed: EVENT_SEED,
    },
    faultId: nearest.id,
    faultDistanceKm: best.distanceKm,
    placement: 'fault',
  };
}
