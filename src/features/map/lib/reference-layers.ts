import type {
  GeoJSONSource,
  LayerSpecification,
  Map as MapLibreMap,
  StyleImageMetadata,
} from 'maplibre-gl';

import type { Districts, Faults, Infra, Station } from '@/data/schemas';
import type { Theme } from '@/state/ui-store';
import { CRITICAL_FACILITY_KINDS } from '@/types/damage';

import { overlayAnchorLayerId } from './layer-order';
import { REFERENCE_PALETTE } from './layer-palette';

/**
 * Static reference context (district outlines, faults, seismic stations) drawn with MapLibre's
 * own layers so it drapes on the 3D terrain; deck.gl layers are not draped on MapLibre terrain.
 */
export interface ReferenceData {
  districts?: Districts | undefined;
  faults?: Faults | undefined;
  stations?: Station[] | undefined;
  infra?: Infra | undefined;
}

export const REFERENCE_SOURCES = {
  districts: 'quaketrace-districts',
  faults: 'quaketrace-faults',
  stations: 'quaketrace-stations',
  facilities: 'quaketrace-facilities',
} as const;

export const FACILITY_LAYER = 'quaketrace-facilities';

/**
 * Feature-state `status` of a facility: 0 not yet reached by the S wave (hidden), then
 * 1 operational, 2 limited, 3 likely out of service.
 */
export const FACILITY_STATUS_CODES = {
  pending: 0,
  operational: 1,
  limited: 2,
  outOfService: 3,
} as const;

export function facilitiesToGeoJson(infra: Infra): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const kinds: readonly string[] = CRITICAL_FACILITY_KINDS;
  return {
    type: 'FeatureCollection',
    features: infra.features.flatMap((feature) =>
      feature.geometry.type === 'Point' && kinds.includes(feature.properties.kind)
        ? [
            {
              type: 'Feature' as const,
              geometry: { type: 'Point' as const, coordinates: feature.geometry.coordinates },
              properties: { id: feature.properties.id, kind: feature.properties.kind },
            },
          ]
        : [],
    ),
  };
}

export const STATION_ICON = 'quaketrace-station-triangle';
export const STATION_LAYER = 'quaketrace-stations';

export function stationsToGeoJson(stations: Station[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: stations.map((station) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [station.lon, station.lat] },
      properties: { id: station.id, accelerometer: station.accelerometer },
    })),
  };
}

/** Layer specifications in draw order; line layers go below the basemap labels. */
export function referenceLayerSpecs(theme: Theme): LayerSpecification[] {
  const palette = REFERENCE_PALETTE[theme];
  return [
    {
      id: 'quaketrace-district-lines',
      type: 'line',
      source: REFERENCE_SOURCES.districts,
      paint: { 'line-color': palette.districtLine, 'line-width': 0.8 },
    },
    {
      id: 'quaketrace-fault-lines',
      type: 'line',
      source: REFERENCE_SOURCES.faults,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': palette.fault,
        // Faster-slipping faults draw thicker: 1 px at 0 mm/yr to 3.5 px at 20 mm/yr and above.
        'line-width': [
          'interpolate',
          ['linear'],
          ['get', 'mean', ['get', 'slipRateMmYr']],
          0,
          1,
          20,
          3.5,
        ],
      },
    },
    {
      id: STATION_LAYER,
      type: 'symbol',
      source: REFERENCE_SOURCES.stations,
      layout: {
        'icon-image': STATION_ICON,
        'icon-size': ['case', ['get', 'accelerometer'], 0.42, 0.32],
        'icon-allow-overlap': true,
      },
      paint: {
        'icon-color': palette.station,
        'icon-halo-color': palette.stationHalo,
        'icon-halo-width': 1,
        'icon-opacity': ['case', ['get', 'accelerometer'], 1, 0.65],
      },
    },
    {
      id: FACILITY_LAYER,
      type: 'circle',
      source: REFERENCE_SOURCES.facilities,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 2.5, 11, 5],
        'circle-color': [
          'match',
          ['coalesce', ['feature-state', 'status'], 0],
          FACILITY_STATUS_CODES.limited,
          palette.facility.limited,
          FACILITY_STATUS_CODES.outOfService,
          palette.facility.outOfService,
          palette.facility.operational,
        ],
        'circle-stroke-color': palette.facility.outline,
        'circle-stroke-width': 0.75,
        // Hidden until the S wave reaches the facility and its state is known.
        'circle-opacity': ['case', ['>', ['coalesce', ['feature-state', 'status'], 0], 0], 1, 0],
        'circle-stroke-opacity': [
          'case',
          ['>', ['coalesce', ['feature-state', 'status'], 0], 0],
          1,
          0,
        ],
      },
    },
  ];
}

/**
 * An upward triangle (the seismological symbol for a station) as an RGBA alpha mask, used as a
 * signed-distance-field icon so MapLibre can tint it per theme.
 */
export function triangleIcon(size = 32): { width: number; height: number; data: Uint8Array } {
  const data = new Uint8Array(size * size * 4);
  const top = size * 0.12;
  const bottom = size * 0.88;
  for (let y = 0; y < size; y++) {
    const py = y + 0.5;
    if (py < top || py > bottom) continue;
    const halfWidth = ((py - top) / (bottom - top)) * (size * 0.45);
    for (let x = 0; x < size; x++) {
      const inside = Math.abs(x + 0.5 - size / 2) <= halfWidth;
      if (inside) data.set([255, 255, 255, 255], (y * size + x) * 4);
    }
  }
  return { width: size, height: size, data };
}

const LINE_LAYER_TYPES = new Set(['line']);

function upsertSource(
  map: MapLibreMap,
  id: string,
  data: GeoJSON.GeoJSON,
  promoteId?: string,
): void {
  const source = map.getSource<GeoJSONSource>(id);
  // setData resolves once the worker has parsed the data; nothing waits on it.
  if (source) void source.setData(data);
  else map.addSource(id, { type: 'geojson', data, ...(promoteId ? { promoteId } : {}) });
}

/** Adds or refreshes reference sources and layers. Safe to call after every style load. */
export function applyReferenceLayers(map: MapLibreMap, data: ReferenceData, theme: Theme): void {
  if (!map.hasImage(STATION_ICON)) {
    const metadata: Partial<StyleImageMetadata> = { sdf: true, pixelRatio: 1 };
    map.addImage(STATION_ICON, triangleIcon(), metadata);
  }
  if (data.districts) upsertSource(map, REFERENCE_SOURCES.districts, data.districts);
  if (data.faults) upsertSource(map, REFERENCE_SOURCES.faults, data.faults);
  if (data.stations)
    upsertSource(map, REFERENCE_SOURCES.stations, stationsToGeoJson(data.stations));
  if (data.infra) {
    upsertSource(map, REFERENCE_SOURCES.facilities, facilitiesToGeoJson(data.infra), 'id');
  }

  const beforeLabels = overlayAnchorLayerId(map.getStyle().layers);
  for (const spec of referenceLayerSpecs(theme)) {
    if (!('source' in spec) || typeof spec.source !== 'string') continue;
    if (map.getLayer(spec.id) || !map.getSource(spec.source)) continue;
    map.addLayer(spec, LINE_LAYER_TYPES.has(spec.type) ? beforeLabels : undefined);
  }
}
