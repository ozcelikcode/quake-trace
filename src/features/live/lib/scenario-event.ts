import type { FeedSource, LiveEvent } from '@/types/live';
import type { ScenarioEvent } from '@/types/scenario';

export const SOURCE_LABELS: Record<FeedSource, string> = {
  afad: 'AFAD',
  kandilli: 'KOERI',
  emsc: 'EMSC',
  usgs: 'USGS',
};

/** Smallest magnitude offered for simulation; smaller shocks barely shake the grid. */
export const MIN_SCENARIO_MAGNITUDE = 4;

export function toScenarioEvent(event: LiveEvent): ScenarioEvent {
  return {
    id: `event:${event.id}`,
    originMs: event.timeMs,
    lon: event.lon,
    lat: event.lat,
    depthKm: event.depthKm,
    magnitude: event.magnitude,
    place: event.place,
    catalog: `${SOURCE_LABELS[event.source]} ${event.sourceId}`,
  };
}
