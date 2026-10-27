import type {
  HillshadeLayerSpecification,
  LngLatBoundsLike,
  RasterDEMSourceSpecification,
} from 'maplibre-gl';

import type { Theme } from '@/state/ui-store';

/** Sea of Marmara with İstanbul and Kocaeli; the opening camera frames this box. */
export const INITIAL_VIEW_BOUNDS = [
  [26.9, 40.2],
  [30.3, 41.3],
] as const satisfies LngLatBoundsLike;

export const INITIAL_VIEW_CENTER: [number, number] = [
  (INITIAL_VIEW_BOUNDS[0][0] + INITIAL_VIEW_BOUNDS[1][0]) / 2,
  (INITIAL_VIEW_BOUNDS[0][1] + INITIAL_VIEW_BOUNDS[1][1]) / 2,
];

/** Credits for the prepared datasets drawn on the map (full list: public/data/ATTRIBUTION.md). */
export const DATA_ATTRIBUTION = [
  'Faults: EFSM20 (CC BY 4.0)',
  'Districts: geoBoundaries',
  'Stations: KOERI, EIDA',
];

/** Below this map width MapLibre shows compact attribution; it starts collapsed there. */
export const COMPACT_ATTRIBUTION_MAX_WIDTH = 640;

/** Panning limit: the region plus a margin. */
export const MAX_BOUNDS: LngLatBoundsLike = [
  [23.5, 38.4],
  [33.5, 43.2],
];

/**
 * Narrow (portrait phone) maps frame the northern Marmara coast, İstanbul between Tekirdağ and
 * İzmit, seen from straight above: a pitched view loads tiles up to the horizon.
 */
export const COMPACT_VIEW = {
  maxWidth: 640,
  bounds: [
    [27.6, 40.45],
    [29.95, 41.25],
  ],
  pitch: 0,
} as const satisfies { maxWidth: number; bounds: LngLatBoundsLike; pitch: number };

export const INITIAL_PITCH = 45;
export const INITIAL_BEARING = -12;
export const MAX_PITCH = 75;
export const TERRAIN_EXAGGERATION = 1.5;

/**
 * Canvas pixel ratio: retina phones report 3, which renders nine times the pixels of the CSS
 * size. Two keeps text and lines sharp on desktops; 1.5 is enough on small screens.
 */
export function mapPixelRatio(compact: boolean): number {
  return Math.min(window.devicePixelRatio, compact ? 1.5 : 2);
}

const BASEMAP_STYLES: Record<Theme, string> = {
  dark: 'https://tiles.openfreemap.org/styles/dark',
  light: 'https://tiles.openfreemap.org/styles/positron',
};

export function basemapStyleUrl(theme: Theme): string {
  return BASEMAP_STYLES[theme];
}

export const TERRAIN_SOURCE_ID = 'quaketrace-terrain';
export const HILLSHADE_SOURCE_ID = 'quaketrace-hillshade';
export const HILLSHADE_LAYER_ID = 'quaketrace-hillshade';

const TERRARIUM_TILES = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const TERRAIN_ATTRIBUTION =
  '<a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noopener">Terrain © Mapzen, AWS Open Data</a>';

/**
 * Terrain and hillshade use separate sources over the same tiles, as MapLibre recommends; the
 * terrain source loads tiles only while terrain is on. Zoom 12 (about 30 m per pixel at 256 px
 * tiles) is finer than the regional view needs, and each level above it quadruples the tiles.
 */
export function demSource(): RasterDEMSourceSpecification {
  return {
    type: 'raster-dem',
    tiles: [TERRARIUM_TILES],
    encoding: 'terrarium',
    tileSize: 256,
    maxzoom: 12,
    attribution: TERRAIN_ATTRIBUTION,
  };
}

/**
 * Hillshade colors are concrete values because WebGL paint properties cannot read CSS
 * variables. They are tuned to sit under the dark and light surface tokens.
 */
const HILLSHADE_PAINT: Record<Theme, NonNullable<HillshadeLayerSpecification['paint']>> = {
  dark: {
    'hillshade-exaggeration': 0.5,
    'hillshade-shadow-color': '#05070b',
    'hillshade-highlight-color': '#4a5568',
    'hillshade-accent-color': '#0b0f16',
  },
  light: {
    'hillshade-exaggeration': 0.35,
    'hillshade-shadow-color': '#5b6475',
    'hillshade-highlight-color': '#ffffff',
    'hillshade-accent-color': '#8a93a3',
  },
};

export function hillshadeLayer(theme: Theme): HillshadeLayerSpecification {
  return {
    id: HILLSHADE_LAYER_ID,
    type: 'hillshade',
    source: HILLSHADE_SOURCE_ID,
    paint: HILLSHADE_PAINT[theme],
  };
}
