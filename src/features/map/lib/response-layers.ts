import type { ExpressionSpecification, LayerSpecification } from 'maplibre-gl';

import type { Theme } from '@/state/ui-store';
import type { NetworkResult, SiteState } from '@/types/network';
import type { RoadGraph } from '@/types/roads';
import { IMPAIRMENTS, type RoutingResult } from '@/types/routing';

import { REFERENCE_PALETTE } from './layer-palette';

/**
 * Scenario layers of the response: corridors, impaired roads and cell sites, as MapLibre
 * GeoJSON layers so they drape on the terrain. Each feature is hidden until the S wave reaches
 * it; `SimulationRenderer` reveals it through feature state.
 */

export const RESPONSE_SOURCES = {
  corridors: 'quaketrace-corridors',
  impaired: 'quaketrace-impaired',
  sites: 'quaketrace-sites',
} as const;

/** Feature-state `state` of a site: 0 hidden, then its display state. */
export const SITE_STATE_CODES: Record<SiteState, number> = {
  pending: 0,
  normal: 1,
  congested: 2,
  down: 3,
};

/** Cell sites appear from this zoom; below it the network raster carries the picture. */
const SITE_MIN_ZOOM = 11;

function edgeSegment(graph: RoadGraph, from: number, edge: number): GeoJSON.LineString {
  const to = graph.edgeTargets[edge] ?? 0;
  return {
    type: 'LineString',
    coordinates: [
      [graph.nodeLonLat[2 * from] ?? 0, graph.nodeLonLat[2 * from + 1] ?? 0],
      [graph.nodeLonLat[2 * to] ?? 0, graph.nodeLonLat[2 * to + 1] ?? 0],
    ],
  };
}

/** Source node of each edge, for drawing edges as segments. */
export function edgeSourceNodes(graph: RoadGraph): Uint32Array {
  const sources = new Uint32Array(graph.edgeCount);
  for (let node = 0; node < graph.nodeCount; node++) {
    sources.fill(node, graph.edgeOffsets[node] ?? 0, graph.edgeOffsets[node + 1] ?? 0);
  }
  return sources;
}

export function corridorsToGeoJson(
  routing: RoutingResult,
  graph: RoadGraph,
  sources: Uint32Array,
): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  return {
    type: 'FeatureCollection',
    features: Array.from(routing.corridorEdges, (edge, i) => ({
      type: 'Feature' as const,
      id: i,
      geometry: edgeSegment(graph, sources[edge] ?? 0, edge),
      properties: { usage: routing.corridorUsage[i] ?? 0 },
    })),
  };
}

export function impairedToGeoJson(
  routing: RoutingResult,
  graph: RoadGraph,
  sources: Uint32Array,
): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  return {
    type: 'FeatureCollection',
    features: Array.from(routing.impairedEdges, (edge, i) => ({
      type: 'Feature' as const,
      id: i,
      geometry: edgeSegment(graph, sources[edge] ?? 0, edge),
      properties: { impairment: IMPAIRMENTS[routing.impairment[i] ?? 0] ?? 'debris' },
    })),
  };
}

export function sitesToGeoJson(network: NetworkResult): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: Array.from({ length: network.siteCount }, (_, site) => ({
      type: 'Feature' as const,
      id: site,
      geometry: {
        type: 'Point' as const,
        coordinates: [network.siteLonLat[2 * site] ?? 0, network.siteLonLat[2 * site + 1] ?? 0],
      },
      properties: {},
    })),
  };
}

const shown: ExpressionSpecification = ['boolean', ['feature-state', 'shown'], false];

/** Line layers (inserted below the basemap labels) and the site layer, in draw order. */
export function responseLayerSpecs(theme: Theme): LayerSpecification[] {
  const palette = REFERENCE_PALETTE[theme];
  // Usage spans orders of magnitude, so width follows its square root; lines widen with zoom.
  const usageWidth = (thin: number, thick: number): ExpressionSpecification => [
    'interpolate',
    ['linear'],
    ['zoom'],
    7,
    ['+', thin, ['*', thick - thin, ['sqrt', ['get', 'usage']]]],
    12,
    ['+', 2 * thin, ['*', 2 * (thick - thin), ['sqrt', ['get', 'usage']]]],
  ];
  return [
    {
      id: 'quaketrace-impaired-debris',
      type: 'line',
      source: RESPONSE_SOURCES.impaired,
      filter: ['==', ['get', 'impairment'], 'debris'],
      paint: {
        'line-color': palette.debris,
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.6, 13, 2],
        'line-dasharray': [2, 1.5],
        'line-opacity': ['case', shown, 0.9, 0],
      },
    },
    {
      id: 'quaketrace-corridor-casing',
      type: 'line',
      source: RESPONSE_SOURCES.corridors,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': palette.corridor.casing,
        'line-width': usageWidth(3, 9),
        'line-opacity': ['case', shown, 1, 0],
      },
    },
    {
      id: 'quaketrace-corridor-lines',
      type: 'line',
      source: RESPONSE_SOURCES.corridors,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': palette.corridor.line,
        'line-width': usageWidth(1.5, 6),
        'line-opacity': ['case', shown, 1, 0],
      },
    },
    {
      id: 'quaketrace-impaired-bridges',
      type: 'line',
      source: RESPONSE_SOURCES.impaired,
      filter: ['==', ['get', 'impairment'], 'bridgeClosed'],
      layout: { 'line-cap': 'round' },
      paint: {
        'line-color': palette.bridgeClosed,
        'line-width': 5,
        'line-opacity': ['case', shown, 1, 0],
      },
    },
    {
      id: 'quaketrace-sites',
      type: 'circle',
      source: RESPONSE_SOURCES.sites,
      minzoom: SITE_MIN_ZOOM,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], SITE_MIN_ZOOM, 2, 14, 4],
        'circle-color': [
          'match',
          ['coalesce', ['feature-state', 'state'], 0],
          SITE_STATE_CODES.congested,
          palette.facility.limited,
          SITE_STATE_CODES.down,
          palette.facility.outOfService,
          palette.facility.operational,
        ],
        'circle-stroke-color': palette.facility.outline,
        'circle-stroke-width': 0.5,
        'circle-opacity': ['case', ['>', ['coalesce', ['feature-state', 'state'], 0], 0], 1, 0],
        'circle-stroke-opacity': [
          'case',
          ['>', ['coalesce', ['feature-state', 'state'], 0], 0],
          1,
          0,
        ],
      },
    },
  ];
}
