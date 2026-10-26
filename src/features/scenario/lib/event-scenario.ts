import { faultSource } from '@/data/fault-source';
import type { Faults } from '@/data/schemas';
import { cumulativeLengthsKm, kmAtLongitude, nearestOnPath } from '@/lib/math/polyline';
import type { Scenario, ScenarioEvent } from '@/types/scenario';

import { PresetError } from './presets';

/** Same seed as the presets, so a replay always reproduces. */
const EVENT_SEED = 1;

export interface EventScenario {
  scenario: Scenario;
  faultId: string;
  faultDistanceKm: number;
}

/**
 * Places a real earthquake on the nearest EFSM20 fault: the hypocentre at the point of the trace
 * nearest the epicentre, at the catalog depth (clamped to the seismogenic layer by the engine),
 * with the catalog magnitude. The rupture spans the given extent or, by default, the Wells and
 * Coppersmith (1994) median area centred on the hypocentre (`engine/rupture`). Epicentres off
 * the mapped faults keep their magnitude but move onto the nearest one; the distance is reported.
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
  const fault = faultSource(faults, best.id);

  let extent: { startKm: number; endKm: number } | undefined;
  if (event.extentLon) {
    const cumulative = cumulativeLengthsKm(fault.trace);
    const [from, to] = event.extentLon.map((lon) => kmAtLongitude(fault.trace, cumulative, lon));
    if (from === undefined || to === undefined) {
      throw new PresetError(`fault ${fault.id} does not span the extent of ${event.id}`);
    }
    extent = { startKm: Math.min(from, to), endKm: Math.max(from, to) };
  }

  return {
    scenario: {
      id: event.id,
      rupture: {
        fault,
        ...extent,
        hypocenterKm: best.km,
        hypocenterDepthKm: event.depthKm,
        mw: event.magnitude,
      },
      seed: EVENT_SEED,
    },
    faultId: fault.id,
    faultDistanceKm: best.distanceKm,
  };
}
