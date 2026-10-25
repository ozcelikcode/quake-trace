import type { Map as MapLibreMap } from 'maplibre-gl';

import type { Theme } from '@/state/ui-store';

import {
  demSource,
  HILLSHADE_LAYER_ID,
  HILLSHADE_SOURCE_ID,
  hillshadeLayer,
  TERRAIN_EXAGGERATION,
  TERRAIN_SOURCE_ID,
} from './map-config';

/** Adds 3D terrain and hillshade below the first label layer. Safe to call after every style load. */
export function applyTerrain(map: MapLibreMap, theme: Theme): void {
  if (!map.getSource(TERRAIN_SOURCE_ID)) map.addSource(TERRAIN_SOURCE_ID, demSource());
  if (!map.getSource(HILLSHADE_SOURCE_ID)) map.addSource(HILLSHADE_SOURCE_ID, demSource());

  if (!map.getLayer(HILLSHADE_LAYER_ID)) {
    const firstLabelLayer = map.getStyle().layers.find((layer) => layer.type === 'symbol');
    map.addLayer(hillshadeLayer(theme), firstLabelLayer?.id);
  }

  map.setTerrain({ source: TERRAIN_SOURCE_ID, exaggeration: TERRAIN_EXAGGERATION });
}
