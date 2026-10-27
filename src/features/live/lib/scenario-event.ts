import { inRegion, type Region } from '@/data/feeds/merge';
import type { LiveScope } from '@/state/live-store';
import type { FeedSource, LiveEvent } from '@/types/live';
import type { ScenarioEvent } from '@/types/scenario';

export const SOURCE_LABELS: Record<FeedSource, string> = {
  afad: 'AFAD',
  kandilli: 'KOERI',
  emsc: 'EMSC',
  usgs: 'USGS',
};

const MARMARA: Region = { west: 26, east: 31, south: 39.8, north: 41.8 };
const TURKEY: Region = { west: 25, east: 45, south: 35.5, north: 42.5 };
/** Worldwide the list keeps the shocks USGS reports everywhere (M ≥ 4.5). */
const WORLD_MIN_MAGNITUDE = 4.5;

/** Whether an event belongs to the chosen scope of the live list and map. */
export function inScope(event: LiveEvent, scope: LiveScope): boolean {
  switch (scope) {
    case 'marmara':
      return inRegion(event, MARMARA);
    case 'turkey':
      return inRegion(event, TURKEY);
    case 'world':
      return event.magnitude >= WORLD_MIN_MAGNITUDE;
  }
}

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
