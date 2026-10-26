import type {
  ExpressionSpecification,
  GeoJSONSource,
  LayerSpecification,
  Map as MapLibreMap,
} from 'maplibre-gl';

import type { Theme } from '@/state/ui-store';
import type { LiveEvent } from '@/types/live';

import { REFERENCE_PALETTE } from './layer-palette';

/**
 * Real earthquakes from the live catalogs as a MapLibre circle layer (draped on the terrain):
 * size by magnitude, fading with age over the 7-day window, the selected event ringed. Shown
 * only while the live list is open.
 */

export const LIVE_SOURCE = 'quaketrace-live';
export const LIVE_LAYER = 'quaketrace-live';
const HOUR_MS = 3_600_000;
const WINDOW_H = 7 * 24;

export function liveToGeoJson(
  events: readonly LiveEvent[],
  nowMs: number,
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: events.map((event) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [event.lon, event.lat] },
      properties: {
        id: event.id,
        magnitude: event.magnitude,
        ageH: Math.max(0, (nowMs - event.timeMs) / HOUR_MS),
      },
    })),
  };
}

export function liveLayerSpec(theme: Theme): LayerSpecification {
  const palette = REFERENCE_PALETTE[theme].live;
  const selected: ExpressionSpecification = ['boolean', ['feature-state', 'selected'], false];
  return {
    id: LIVE_LAYER,
    type: 'circle',
    source: LIVE_SOURCE,
    layout: { 'circle-sort-key': ['get', 'magnitude'] },
    paint: {
      'circle-radius': ['interpolate', ['exponential', 1.5], ['get', 'magnitude'], 0, 3, 7, 20],
      'circle-color': palette.fill,
      'circle-opacity': ['interpolate', ['linear'], ['get', 'ageH'], 0, 0.95, WINDOW_H, 0.3],
      'circle-stroke-color': ['case', selected, palette.selected, palette.outline],
      'circle-stroke-width': ['case', selected, 2.5, 0.75],
    },
  };
}

/** Adds or refreshes the live layer; safe after every style load. */
export function applyLiveLayer(
  map: MapLibreMap,
  events: readonly LiveEvent[],
  selectedId: string | null,
  theme: Theme,
  visible: boolean,
): void {
  const data = liveToGeoJson(events, Date.now());
  const source = map.getSource<GeoJSONSource>(LIVE_SOURCE);
  if (source) void source.setData(data);
  else map.addSource(LIVE_SOURCE, { type: 'geojson', data, promoteId: 'id' });
  if (!map.getLayer(LIVE_LAYER)) map.addLayer(liveLayerSpec(theme));
  map.setLayoutProperty(LIVE_LAYER, 'visibility', visible ? 'visible' : 'none');
  map.removeFeatureState({ source: LIVE_SOURCE });
  if (selectedId) map.setFeatureState({ source: LIVE_SOURCE, id: selectedId }, { selected: true });
}
