import type {
  ExpressionSpecification,
  GeoJSONSource,
  LayerSpecification,
  Map as MapLibreMap,
} from 'maplibre-gl';

import { faultSource } from '@/data/fault-source';
import type { Faults } from '@/data/schemas';
import { cumulativeLengthsKm, pointAtKm } from '@/lib/math/polyline';
import type { Theme } from '@/state/ui-store';
import type { ScenarioDraft } from '@/types/scenario';

import { REFERENCE_PALETTE } from './layer-palette';
import { REFERENCE_SOURCES } from './reference-layers';

/**
 * Scenario editor preview, shown while the editor is open: the chosen fault traced in the
 * signal hue and the hypocentre on it, plus a wide transparent line over every fault so a
 * click near one picks it (the fault lines themselves are 1–3.5 px).
 */

const EDITOR_SOURCE = 'quaketrace-editor';
export const FAULT_HIT_LAYER = 'quaketrace-fault-hit';
const LAYERS = {
  casing: 'quaketrace-editor-casing',
  line: 'quaketrace-editor-line',
  hypocenter: 'quaketrace-editor-hypocenter',
} as const;

function draftToGeoJson(draft: ScenarioDraft, faults: Faults): GeoJSON.FeatureCollection {
  const { trace } = faultSource(faults, draft.faultId);
  const { point } = pointAtKm(trace, cumulativeLengthsKm(trace), draft.hypocenterKm);
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: trace.map(([lon, lat]) => [lon, lat]) },
        properties: { part: 'fault' },
      },
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: point },
        properties: { part: 'hypocenter' },
      },
    ],
  };
}

function editorLayerSpecs(theme: Theme): LayerSpecification[] {
  const palette = REFERENCE_PALETTE[theme].editor;
  const fault: ExpressionSpecification = ['==', ['get', 'part'], 'fault'];
  return [
    {
      id: FAULT_HIT_LAYER,
      type: 'line',
      source: REFERENCE_SOURCES.faults,
      paint: { 'line-color': palette.line, 'line-opacity': 0, 'line-width': 16 },
    },
    {
      id: LAYERS.casing,
      type: 'line',
      source: EDITOR_SOURCE,
      filter: fault,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': palette.casing, 'line-width': 6 },
    },
    {
      id: LAYERS.line,
      type: 'line',
      source: EDITOR_SOURCE,
      filter: fault,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': palette.line, 'line-width': 3 },
    },
    {
      id: LAYERS.hypocenter,
      type: 'circle',
      source: EDITOR_SOURCE,
      filter: ['==', ['get', 'part'], 'hypocenter'],
      paint: {
        'circle-radius': 6,
        'circle-color': palette.casing,
        'circle-stroke-color': palette.line,
        'circle-stroke-width': 3,
      },
    },
  ];
}

/** Adds or refreshes the preview; safe after every style load. Needs the faults source. */
export function applyEditorLayers(
  map: MapLibreMap,
  draft: ScenarioDraft | null,
  faults: Faults | undefined,
  theme: Theme,
  visible: boolean,
): void {
  if (!faults || !map.getSource(REFERENCE_SOURCES.faults)) return;
  const data: GeoJSON.FeatureCollection = draft
    ? draftToGeoJson(draft, faults)
    : { type: 'FeatureCollection', features: [] };
  const source = map.getSource<GeoJSONSource>(EDITOR_SOURCE);
  if (source) void source.setData(data);
  else map.addSource(EDITOR_SOURCE, { type: 'geojson', data });
  for (const spec of editorLayerSpecs(theme)) {
    if (!map.getLayer(spec.id)) map.addLayer(spec);
    map.setLayoutProperty(spec.id, 'visibility', visible && draft ? 'visible' : 'none');
  }
}
