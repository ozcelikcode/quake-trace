import type { Layer } from '@deck.gl/core';
import { LineLayer, PathLayer, ScatterplotLayer } from '@deck.gl/layers';
import type { MapLibreOverlay } from '@deck.gl/maplibre';
import type { GeoJSONSource, ImageSource, Map as MapLibreMap } from 'maplibre-gl';

import { siteState } from '@/features/cells';
import { facilityStatus } from '@/features/infra';
import type { MapRaster, Theme } from '@/state/ui-store';
import type { GridSpec } from '@/types/grid';
import type { RoadGraph } from '@/types/roads';
import type { SimulationResult, StationRecord } from '@/types/simulation';
import type { TsunamiResult } from '@/types/tsunami';

import { overlayAnchorLayerId } from './layer-order';
import { LOAD_ANCHORS, REFERENCE_PALETTE, TSUNAMI_NEG, TSUNAMI_POS } from './layer-palette';
import { FACILITY_STATUS_CODES, REFERENCE_SOURCES } from './reference-layers';
import { TERRAIN_EXAGGERATION } from './map-config';
import {
  corridorsToGeoJson,
  edgeSourceNodes,
  impairedToGeoJson,
  RESPONSE_SOURCES,
  responseLayerSpecs,
  SITE_STATE_CODES,
  sitesToGeoJson,
} from './response-layers';
import {
  loadLookupTable,
  mercatorRowMap,
  mmiLookupTable,
  paintIntensity,
  paintNetwork,
  paintTsunami,
  tsunamiCellIndex,
  tsunamiLookupTable,
  rupturedPath,
  wavefrontCurtain,
  type CurtainBuffers,
  type CurtainStyle,
} from './simulation-frames';
import { TimedReveal } from './timed-reveal';

/**
 * Draws a scenario at a given time: the intensity or network raster as a MapLibre image source
 * (draped on the terrain, below the reference lines), the response layers (corridors, impaired
 * roads, cell sites) as MapLibre GeoJSON layers revealed through feature state, and the
 * wavefronts, rupture, epicentre and station triggers as deck.gl layers lifted onto the terrain
 * with the elevation grid.
 */

const INTENSITY_SOURCE = 'quaketrace-intensity';
const INTENSITY_LAYER = 'quaketrace-intensity';
/** The raster goes below the reference district lines so outlines and faults stay visible. */
const RASTER_BELOW = 'quaketrace-district-lines';

const CURTAIN_LEVELS_M = [250, 900, 1550, 2200, 2850];
const CURTAIN_ALPHAS = [1, 0.5, 0.3, 0.17, 0.08];
/** Wave colours: the P and S hues of the design system (designSystem.md, physical quantities). */
const P_STYLE: CurtainStyle = {
  color: [94, 200, 255],
  levelsM: CURTAIN_LEVELS_M,
  alphas: CURTAIN_ALPHAS,
  terrainExaggeration: TERRAIN_EXAGGERATION,
};
const S_STYLE: CurtainStyle = { ...P_STYLE, color: [255, 166, 77] };
const RUPTURE_LIFT_M = 200;
/**
 * Blind-zone boundary: the S-wave isochrone at the alert time, low and in the critical hue
 * (designSystem.md state colours; WebGL cannot read the CSS token).
 */
const BLIND_ZONE_STYLE: CurtainStyle = {
  color: [235, 87, 70],
  levelsM: [120],
  alphas: [0.95],
  terrainExaggeration: TERRAIN_EXAGGERATION,
};
const CRITICAL: [number, number, number] = [235, 87, 70];
/** A triggered station flashes with one expanding ring, then keeps a steady P-coloured dot. */
const TRIGGER_PULSE_S = 1.2;
const STATION_LIFT_M = 60;

interface StationPoint {
  station: StationRecord;
  position: [number, number, number];
}

function curtainLayer(id: string, curtain: CurtainBuffers): LineLayer {
  return new LineLayer({
    id,
    data: {
      length: curtain.length,
      attributes: {
        getSourcePosition: { value: curtain.sourcePositions, size: 3 },
        getTargetPosition: { value: curtain.targetPositions, size: 3 },
        getColor: { value: curtain.colors, size: 4, normalized: true },
      },
    },
    getWidth: 2,
    widthUnits: 'pixels',
  });
}

export class SimulationRenderer {
  readonly #map: MapLibreMap;
  readonly #overlay: MapLibreOverlay;
  readonly #lookup = mmiLookupTable();
  readonly #loadLookup = loadLookupTable(LOAD_ANCHORS);
  readonly #tsunamiLookup = tsunamiLookupTable(TSUNAMI_NEG, TSUNAMI_POS);
  #tsunami: { result: TsunamiResult; cellIndex: Int32Array } | null = null;
  #raster: MapRaster = 'intensity';
  #roads: RoadGraph | undefined;
  #result: SimulationResult | null = null;
  /** Response layer data and reveal state, rebuilt for a new result or road graph. */
  #response: {
    data: Record<keyof typeof RESPONSE_SOURCES, GeoJSON.FeatureCollection>;
    reveals: Record<keyof typeof RESPONSE_SOURCES, TimedReveal>;
  } | null = null;
  #elevation: Float32Array | undefined;
  #image: ImageData | null = null;
  #pixels: Uint32Array | null = null;
  #rowMap: Int32Array | null = null;
  #lastTimeS = Number.NaN;
  #theme: Theme = 'dark';
  #focusedStation = -1;
  #blindZone: CurtainBuffers | null = null;
  /** Facility status codes last written as MapLibre feature state. */
  readonly #facilityCodes = new Map<string, number>();
  readonly #reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  constructor(map: MapLibreMap, overlay: MapLibreOverlay) {
    this.#map = map;
    this.#overlay = overlay;
  }

  /** Ground elevation on the result's grid (m), used to lift 3D elements onto the terrain. */
  setElevation(values: Float32Array | undefined): void {
    this.#elevation = values;
    this.#blindZone = null;
    this.#lastTimeS = Number.NaN;
  }

  setTheme(theme: Theme): void {
    this.#theme = theme;
    this.#lastTimeS = Number.NaN;
  }

  setRaster(raster: MapRaster): void {
    this.#raster = raster;
    this.#lastTimeS = Number.NaN;
  }

  /** The tsunami of the current scenario, drawn when the tsunami raster is chosen. */
  setTsunami(result: TsunamiResult | null): void {
    const matches = result && result.scenarioId === this.#result?.scenarioId;
    this.#tsunami = matches ? { result, cellIndex: tsunamiCellIndex(result) } : null;
    this.#lastTimeS = Number.NaN;
  }

  /** The road graph the routing result indexes; corridors need it for their geometry. */
  setRoads(graph: RoadGraph | undefined): void {
    if (graph === this.#roads) return;
    this.#roads = graph;
    this.#buildResponse();
    this.attach();
  }

  /** Index of the focused station's record, or -1. */
  setFocusedStation(index: number): void {
    this.#focusedStation = index;
    this.#lastTimeS = Number.NaN;
  }

  setResult(result: SimulationResult | null): void {
    this.#result = result;
    if (this.#tsunami?.result.scenarioId !== result?.scenarioId) this.#tsunami = null;
    this.#blindZone = null;
    this.resetFacilityStates();
    this.#lastTimeS = Number.NaN;
    this.#removeRaster();
    this.#buildResponse();
    if (!result) {
      this.#image = null;
      this.#pixels = null;
      this.#overlay.setProps({ layers: [] });
      return;
    }
    const image = new ImageData(result.grid.nx, result.grid.ny);
    this.#image = image;
    this.#pixels = new Uint32Array(image.data.buffer);
    this.#rowMap = mercatorRowMap(result.grid);
    this.attach();
  }

  /**
   * Adds the raster to the current style; call again after every style load. An image source
   * fed with `updateImage` is used rather than a canvas source: with 3D terrain, MapLibre caches
   * draped rasters, and only a source update invalidates that cache.
   */
  attach(): void {
    const result = this.#result;
    if (!result || !this.#image) return;
    this.#removeRaster();
    this.#map.addSource(INTENSITY_SOURCE, { type: 'image', coordinates: corners(result.grid) });
    const below = this.#map.getLayer(RASTER_BELOW)
      ? RASTER_BELOW
      : overlayAnchorLayerId(this.#map.getStyle().layers);
    this.resetFacilityStates();
    this.#map.addLayer(
      {
        id: INTENSITY_LAYER,
        type: 'raster',
        source: INTENSITY_SOURCE,
        paint: { 'raster-opacity': 0.8, 'raster-resampling': 'linear', 'raster-fade-duration': 0 },
      },
      below,
    );
    this.#attachResponse();
    this.#lastTimeS = Number.NaN;
  }

  #buildResponse(): void {
    const result = this.#result;
    const graph = this.#roads;
    if (!result?.routing || !result.network || !graph) {
      this.#response = null;
      return;
    }
    const { routing, network } = result;
    const sources = edgeSourceNodes(graph);
    this.#response = {
      data: {
        corridors: corridorsToGeoJson(routing, graph, sources),
        impaired: impairedToGeoJson(routing, graph, sources),
        sites: sitesToGeoJson(network),
      },
      reveals: {
        corridors: new TimedReveal(routing.corridorFromS),
        impaired: new TimedReveal(routing.impairedAtS),
        sites: new TimedReveal(network.siteSArrivalS),
      },
    };
  }

  /** Adds the response sources and layers; feature states start hidden. */
  #attachResponse(): void {
    const response = this.#response;
    if (!response) return;
    for (const [key, id] of Object.entries(RESPONSE_SOURCES) as [
      keyof typeof RESPONSE_SOURCES,
      string,
    ][]) {
      const source = this.#map.getSource<GeoJSONSource>(id);
      if (source) void source.setData(response.data[key]);
      else this.#map.addSource(id, { type: 'geojson', data: response.data[key] });
      this.#map.removeFeatureState({ source: id });
      response.reveals[key].reset();
    }
    const beforeLabels = overlayAnchorLayerId(this.#map.getStyle().layers);
    for (const spec of responseLayerSpecs(this.#theme)) {
      if (this.#map.getLayer(spec.id)) continue;
      this.#map.addLayer(spec, spec.type === 'line' ? beforeLabels : undefined);
    }
  }

  #updateResponse(result: SimulationResult, timeS: number): void {
    const response = this.#response;
    const network = result.network;
    if (!response || !network || !this.#map.getSource(RESPONSE_SOURCES.sites)) return;
    const showLine = (source: string) => (id: number, shown: boolean) => {
      this.#map.setFeatureState({ source, id }, { shown });
    };
    response.reveals.corridors.update(timeS, showLine(RESPONSE_SOURCES.corridors));
    response.reveals.impaired.update(timeS, showLine(RESPONSE_SOURCES.impaired));
    response.reveals.sites.update(timeS, (site, shown) => {
      // A site's state is fixed once the S wave has passed: demand stays above normal for hours.
      const arrival = network.siteSArrivalS[site] ?? Number.POSITIVE_INFINITY;
      const state = shown ? SITE_STATE_CODES[siteState(network, site, arrival)] : 0;
      this.#map.setFeatureState({ source: RESPONSE_SOURCES.sites, id: site }, { state });
    });
  }

  render(timeS: number): void {
    const result = this.#result;
    if (!result || timeS === this.#lastTimeS) return;
    this.#lastTimeS = timeS;

    if (this.#pixels && this.#rowMap && this.#image) {
      const tsunami = this.#tsunami;
      if (this.#raster === 'tsunami' && tsunami) {
        paintTsunami(
          this.#pixels,
          this.#rowMap,
          tsunami.result,
          tsunami.cellIndex,
          this.#tsunamiLookup,
          timeS,
        );
      } else if (this.#raster === 'network' && result.network) {
        paintNetwork(
          this.#pixels,
          result.grid,
          this.#rowMap,
          result.network,
          this.#loadLookup,
          timeS,
        );
      } else {
        paintIntensity(
          this.#pixels,
          result.grid,
          this.#rowMap,
          result.tS,
          result.mmi,
          this.#lookup,
          timeS,
        );
      }
      this.#map.getSource<ImageSource>(INTENSITY_SOURCE)?.updateImage({ image: this.#image });
    }

    const { rupture } = result;
    const lift = (point: readonly [number, number]): [number, number, number] => [
      point[0],
      point[1],
      this.#groundAt(result.grid, point[0], point[1]) + RUPTURE_LIFT_M,
    ];
    const extent = rupture.trace.map(lift);
    const front = rupturedPath(rupture.trace, rupture.traceTimesS, timeS).map(lift);
    const epicentre = lift([rupture.hypocenter.lon, rupture.hypocenter.lat]);

    const layers: Layer[] = [
      new PathLayer<[number, number, number][]>({
        id: 'scenario-rupture-extent',
        data: [extent],
        getPath: (path) => path,
        getColor: [255, 255, 255, 70],
        getWidth: 3,
        widthUnits: 'pixels',
      }),
      new PathLayer<[number, number, number][]>({
        id: 'scenario-rupture-front',
        data: front.length > 1 ? [front] : [],
        getPath: (path) => path,
        getColor: [255, 255, 255, 255],
        getWidth: 4,
        widthUnits: 'pixels',
        capRounded: true,
      }),
      new ScatterplotLayer<[number, number, number]>({
        id: 'scenario-epicentre',
        data: [epicentre],
        getPosition: (position) => position,
        getRadius: 6,
        radiusUnits: 'pixels',
        getFillColor: [255, 255, 255, 255],
        getLineColor: [13, 17, 23, 255],
        getLineWidth: 2,
        lineWidthUnits: 'pixels',
        stroked: true,
      }),
      curtainLayer(
        'scenario-s-wave',
        wavefrontCurtain(result.tS, result.grid, timeS, this.#elevation, S_STYLE),
      ),
      curtainLayer(
        'scenario-p-wave',
        wavefrontCurtain(result.tP, result.grid, timeS, this.#elevation, P_STYLE),
      ),
      ...this.#stationLayers(result, timeS),
      ...this.#warningLayers(result, timeS),
    ];
    this.#overlay.setProps({ layers });
    this.#updateFacilities(result, timeS);
    this.#updateResponse(result, timeS);
  }

  /** Forgets written facility states, for a new result, style or facility source. */
  resetFacilityStates(): void {
    this.#facilityCodes.clear();
    this.#lastTimeS = Number.NaN;
    if (this.#map.getSource(REFERENCE_SOURCES.facilities)) {
      this.#map.removeFeatureState({ source: REFERENCE_SOURCES.facilities });
    }
  }

  /** Writes a facility's state only when it changes (when the S wave reaches it). */
  #updateFacilities(result: SimulationResult, timeS: number): void {
    const source = REFERENCE_SOURCES.facilities;
    if (!this.#map.getSource(source)) return;
    for (const facility of result.damage?.facilities ?? []) {
      const code =
        FACILITY_STATUS_CODES[facilityStatus(facility.lossRatio, facility.sArrivalS, timeS)];
      if (this.#facilityCodes.get(facility.id) === code) continue;
      this.#facilityCodes.set(facility.id, code);
      this.#map.setFeatureState({ source, id: facility.id }, { status: code });
    }
  }

  /** After the alert: the blind-zone boundary and the estimated epicentre. */
  #warningLayers(result: SimulationResult, timeS: number): Layer[] {
    const warning = result.earlyWarning;
    if (!warning || timeS < warning.alertS) return [];
    this.#blindZone ??= wavefrontCurtain(
      result.tS,
      result.grid,
      warning.alertS,
      this.#elevation,
      BLIND_ZONE_STYLE,
    );
    const { lon, lat } = warning.epicenter;
    const estimate: [number, number, number] = [
      lon,
      lat,
      this.#groundAt(result.grid, lon, lat) + RUPTURE_LIFT_M,
    ];
    return [
      curtainLayer('scenario-blind-zone', this.#blindZone),
      new ScatterplotLayer<[number, number, number]>({
        id: 'scenario-estimated-epicentre',
        data: [estimate],
        getPosition: (position) => position,
        getRadius: 11,
        radiusUnits: 'pixels',
        stroked: true,
        filled: false,
        getLineColor: [...CRITICAL, 255],
        getLineWidth: 2,
        lineWidthUnits: 'pixels',
      }),
    ];
  }

  #stationLayers(result: SimulationResult, timeS: number): Layer[] {
    const points: StationPoint[] = result.records.stations.map((station) => ({
      station,
      position: [
        station.lon,
        station.lat,
        this.#groundAt(result.grid, station.lon, station.lat) + STATION_LIFT_M,
      ],
    }));
    const triggered = points.filter(
      ({ station }) => station.triggerS !== null && station.triggerS <= timeS,
    );
    const phase = ({ station }: StationPoint) =>
      (timeS - (station.triggerS ?? 0)) / TRIGGER_PULSE_S;
    const pulsing = this.#reducedMotion.matches
      ? []
      : triggered.filter((point) => phase(point) < 1);
    const focused = points[this.#focusedStation];
    const [r, g, b] = P_STYLE.color;

    return [
      new ScatterplotLayer<StationPoint>({
        id: 'scenario-station-pulse',
        data: pulsing,
        getPosition: (point) => point.position,
        getRadius: (point) => 5 + 18 * phase(point),
        getLineColor: (point) => [r, g, b, Math.round(255 * (1 - phase(point)))],
        radiusUnits: 'pixels',
        stroked: true,
        filled: false,
        getLineWidth: 2,
        lineWidthUnits: 'pixels',
        updateTriggers: { getRadius: timeS, getLineColor: timeS },
      }),
      new ScatterplotLayer<StationPoint>({
        id: 'scenario-station-triggered',
        data: triggered,
        getPosition: (point) => point.position,
        getRadius: 3.5,
        radiusUnits: 'pixels',
        getFillColor: [r, g, b, 255],
        stroked: true,
        getLineColor: [13, 17, 23, 200],
        getLineWidth: 1,
        lineWidthUnits: 'pixels',
      }),
      new ScatterplotLayer<StationPoint>({
        id: 'scenario-station-focus',
        data: focused ? [focused] : [],
        getPosition: (point) => point.position,
        getRadius: 9,
        radiusUnits: 'pixels',
        stroked: true,
        filled: false,
        getLineColor: [...REFERENCE_PALETTE[this.#theme].selection, 255],
        getLineWidth: 2,
        lineWidthUnits: 'pixels',
        updateTriggers: { getLineColor: this.#theme },
      }),
    ];
  }

  dispose(): void {
    this.#removeRaster();
    this.#overlay.setProps({ layers: [] });
    this.#result = null;
  }

  #groundAt(spec: GridSpec, lon: number, lat: number): number {
    const elevation = this.#elevation;
    if (!elevation) return 0;
    const col = Math.min(spec.nx - 1, Math.max(0, Math.floor((lon - spec.west) / spec.dLon)));
    const row = Math.min(spec.ny - 1, Math.max(0, Math.floor((spec.north - lat) / spec.dLat)));
    return Math.max(0, elevation[row * spec.nx + col] ?? 0) * TERRAIN_EXAGGERATION;
  }

  #removeRaster(): void {
    if (this.#map.getLayer(INTENSITY_LAYER)) this.#map.removeLayer(INTENSITY_LAYER);
    if (this.#map.getSource(INTENSITY_SOURCE)) this.#map.removeSource(INTENSITY_SOURCE);
    for (const spec of responseLayerSpecs(this.#theme)) {
      if (this.#map.getLayer(spec.id)) this.#map.removeLayer(spec.id);
    }
    for (const id of Object.values(RESPONSE_SOURCES)) {
      if (this.#map.getSource(id)) this.#map.removeSource(id);
    }
  }
}

function corners(
  spec: GridSpec,
): [[number, number], [number, number], [number, number], [number, number]] {
  const east = spec.west + spec.nx * spec.dLon;
  const south = spec.north - spec.ny * spec.dLat;
  return [
    [spec.west, spec.north],
    [east, spec.north],
    [east, south],
    [spec.west, south],
  ];
}
