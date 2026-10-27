import type { Layer } from '@deck.gl/core';
import { LineLayer, PathLayer, ScatterplotLayer } from '@deck.gl/layers';
import type { MapLibreOverlay } from '@deck.gl/maplibre';
import type { GeoJSONSource, ImageSource, Map as MapLibreMap } from 'maplibre-gl';

import { siteState } from '@/features/cells';
import { facilityStatus } from '@/features/infra';
import type { MapRaster, Theme } from '@/state/ui-store';
import { cellIndex } from '@/lib/math/grid';
import type { GridSpec } from '@/types/grid';
import type { RoadGraph } from '@/types/roads';
import type { SimulationResult, StationRecord } from '@/types/simulation';
import type { TsunamiResult } from '@/types/tsunami';

import { overlayAnchorLayerId } from './layer-order';
import { LOAD_ANCHORS, REFERENCE_PALETTE, TSUNAMI_NEG, TSUNAMI_POS } from './layer-palette';
import { FACILITY_STATUS_CODES, REFERENCE_SOURCES } from './reference-layers';
import { TERRAIN_EXAGGERATION } from './map-config';
import {
  aftershocksToGeoJson,
  corridorsToGeoJson,
  edgeSourceNodes,
  impairedToGeoJson,
  RESPONSE_SOURCES,
  responseLayerSpecs,
  type ResponseSource,
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
  SHAKING_FADE_S,
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
/**
 * The raster upload (which also re-drapes every terrain tile) and the wavefront isolines are
 * redrawn at most this often while the clock runs; the cheap deck.gl marks follow every frame.
 * Fifteen updates a second keep the 1.5 s fade and the fronts smooth at a fraction of the cost.
 */
const HEAVY_INTERVAL_MS = 1000 / 15;

/** Largest finite value of a field (the last arrival), or -Infinity when there is none. */
function lastFinite(values: Float32Array): number {
  let last = Number.NEGATIVE_INFINITY;
  for (const value of values) if (value > last && Number.isFinite(value)) last = value;
  return last;
}

interface StationPoint {
  station: StationRecord;
  position: [number, number, number];
}

interface RasterCanvas {
  grid: GridSpec;
  image: ImageData;
  pixels: Uint32Array;
  rowMap: Int32Array;
}

interface StaticPositions {
  extent: [number, number, number][];
  stations: StationPoint[];
}

const EMPTY_CURTAIN: CurtainBuffers = {
  length: 0,
  sourcePositions: new Float32Array(0),
  targetPositions: new Float32Array(0),
  colors: new Uint8Array(0),
};

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
  /**
   * Response layer data and reveal state per source, rebuilt for a new result or road graph;
   * corridors and impaired roads need the road graph, sites the network.
   */
  #response: Partial<
    Record<ResponseSource, { data: GeoJSON.FeatureCollection; reveal: TimedReveal }>
  > = {};
  /** Ground elevation (m) at a point, for curtains; undefined on the flat map. */
  #elevationAt: ((lon: number, lat: number) => number) | undefined;
  /**
   * The raster image and the grid it covers: intensity on the event grid, the network on the
   * regional grid, the sea surface on the tsunami grid. The image source follows the grid.
   */
  #canvas: RasterCanvas | null = null;
  #lastTimeS = Number.NaN;
  /** Raster time last painted, and when (performance.now()); NaN forces the next paint. */
  #rasterTimeS = Number.NaN;
  #heavyAtMs = Number.NEGATIVE_INFINITY;
  #trailing: ReturnType<typeof setTimeout> | undefined;
  /** Wavefront curtains of the last heavy update, reused by the frames in between. */
  #curtains: { s: CurtainBuffers; p: CurtainBuffers } | null = null;
  /** Per-result constants: when the fronts leave the grid and when the intensity stops changing. */
  #lastArrival = { s: Number.NEGATIVE_INFINITY, p: Number.NEGATIVE_INFINITY };
  /** Positions that only change with the result or the elevation. */
  #static: StaticPositions | null = null;
  #theme: Theme = 'dark';
  #focusedStation = -1;
  #blindZone: CurtainBuffers | null = null;
  /** Facility status codes last written as MapLibre feature state. */
  readonly #facilityCodes = new Map<string, number>();
  readonly #reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /** Shortest interval between drawn frames; phones draw at most 30 a second. */
  readonly #frameIntervalMs: number;
  #frameAtMs = Number.NEGATIVE_INFINITY;
  #pendingFrame: ReturnType<typeof setTimeout> | undefined;

  constructor(map: MapLibreMap, overlay: MapLibreOverlay, { compact }: { compact: boolean }) {
    this.#map = map;
    this.#overlay = overlay;
    this.#frameIntervalMs = compact ? 1000 / 30 - 2 : 0;
  }

  /** Ground elevation grid (m), used to lift 3D elements onto the terrain. */
  setElevation(elevation: { spec: GridSpec; values: Float32Array } | undefined): void {
    this.#elevationAt = elevation
      ? (lon, lat) => {
          const cell = cellIndex(elevation.spec, lon, lat);
          return cell < 0 ? 0 : (elevation.values[cell] ?? 0);
        }
      : undefined;
    this.#blindZone = null;
    this.#static = null;
    this.#invalidate();
  }

  setTheme(theme: Theme): void {
    this.#theme = theme;
    this.#invalidate();
  }

  setRaster(raster: MapRaster): void {
    this.#raster = raster;
    this.#invalidate();
  }

  /** The tsunami of the current scenario, drawn when the tsunami raster is chosen. */
  setTsunami(result: TsunamiResult | null): void {
    const matches = result && result.scenarioId === this.#result?.scenarioId;
    this.#tsunami = matches ? { result, cellIndex: tsunamiCellIndex(result) } : null;
    this.#invalidate();
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
    this.#static = null;
    this.resetFacilityStates();
    this.#invalidate();
    this.#removeRaster();
    this.#buildResponse();
    if (!result) {
      this.#canvas = null;
      this.#overlay.setProps({ layers: [] });
      return;
    }
    this.#lastArrival = { s: lastFinite(result.tS), p: lastFinite(result.tP) };
    this.attach();
  }

  /**
   * Adds the raster to the current style; call again after every style load. An image source
   * fed with `updateImage` is used rather than a canvas source: with 3D terrain, MapLibre caches
   * draped rasters, and only a source update invalidates that cache.
   */
  attach(): void {
    const result = this.#result;
    if (!result) return;
    this.#removeRaster();
    const grid = this.#rasterGrid(result);
    this.#canvas = this.#canvasFor(grid);
    this.#map.addSource(INTENSITY_SOURCE, { type: 'image', coordinates: corners(grid) });
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
    this.#invalidate();
  }

  /** The grid of the raster currently shown. */
  #rasterGrid(result: SimulationResult): GridSpec {
    if (this.#raster === 'tsunami' && this.#tsunami) return this.#tsunami.result.grid;
    if (this.#raster === 'network' && result.network) return result.regionGrid;
    return result.grid;
  }

  #canvasFor(grid: GridSpec): RasterCanvas {
    if (this.#canvas?.grid === grid) return this.#canvas;
    const image = new ImageData(grid.nx, grid.ny);
    return {
      grid,
      image,
      pixels: new Uint32Array(image.data.buffer),
      rowMap: mercatorRowMap(grid),
    };
  }

  /** Forces the next `render` to redraw everything, raster included. */
  #invalidate(): void {
    this.#lastTimeS = Number.NaN;
    this.#rasterTimeS = Number.NaN;
    this.#heavyAtMs = Number.NEGATIVE_INFINITY;
  }

  /**
   * The time the raster shows for `timeS`: the intensity stops changing once the last cell has
   * faded in, and the tsunami after its last frame, so later frames reuse the painted image.
   */
  #rasterTime(result: SimulationResult, timeS: number): number {
    if (this.#raster === 'tsunami' && this.#tsunami) {
      const { frameCount, frameIntervalS } = this.#tsunami.result;
      return Math.min(timeS, (frameCount - 1) * frameIntervalS);
    }
    if (this.#raster === 'network' && result.network) return timeS;
    return Math.min(timeS, this.#lastArrival.s + SHAKING_FADE_S);
  }

  #buildResponse(): void {
    const result = this.#result;
    const graph = this.#roads;
    this.#response = {};
    if (!result) return;
    const response = this.#response;
    if (result.routing && graph) {
      const sources = edgeSourceNodes(graph);
      response.corridors = {
        data: corridorsToGeoJson(result.routing, graph, sources),
        reveal: new TimedReveal(result.routing.corridorFromS),
      };
      response.impaired = {
        data: impairedToGeoJson(result.routing, graph, sources),
        reveal: new TimedReveal(result.routing.impairedAtS),
      };
    }
    if (result.network) {
      response.sites = {
        data: sitesToGeoJson(result.network),
        reveal: new TimedReveal(result.network.siteSArrivalS),
      };
    }
    response.aftershocks = {
      data: aftershocksToGeoJson(result.aftershocks),
      reveal: new TimedReveal(result.aftershocks.timeS),
    };
  }

  /** Adds the response sources and layers; feature states start hidden. */
  #attachResponse(): void {
    for (const key of Object.keys(RESPONSE_SOURCES) as ResponseSource[]) {
      const entry = this.#response[key];
      if (!entry) continue;
      const id = RESPONSE_SOURCES[key];
      const source = this.#map.getSource<GeoJSONSource>(id);
      if (source) void source.setData(entry.data);
      else this.#map.addSource(id, { type: 'geojson', data: entry.data });
      this.#map.removeFeatureState({ source: id });
      entry.reveal.reset();
    }
    const beforeLabels = overlayAnchorLayerId(this.#map.getStyle().layers);
    for (const spec of responseLayerSpecs(this.#theme)) {
      if (!('source' in spec) || typeof spec.source !== 'string') continue;
      if (this.#map.getLayer(spec.id) || !this.#map.getSource(spec.source)) continue;
      this.#map.addLayer(spec, spec.type === 'line' ? beforeLabels : undefined);
    }
  }

  #updateResponse(result: SimulationResult, timeS: number): void {
    const show = (key: ResponseSource) => (id: number, shown: boolean) => {
      this.#map.setFeatureState({ source: RESPONSE_SOURCES[key], id }, { shown });
    };
    for (const key of ['corridors', 'impaired', 'aftershocks'] as const) {
      if (this.#map.getSource(RESPONSE_SOURCES[key]))
        this.#response[key]?.reveal.update(timeS, show(key));
    }
    const network = result.network;
    if (!network || !this.#map.getSource(RESPONSE_SOURCES.sites)) return;
    this.#response.sites?.reveal.update(timeS, (site, shown) => {
      // A site's state is fixed once the S wave has passed: demand stays above normal for hours.
      const arrival = network.siteSArrivalS[site] ?? Number.POSITIVE_INFINITY;
      const state = shown ? SITE_STATE_CODES[siteState(network, site, arrival)] : 0;
      this.#map.setFeatureState({ source: RESPONSE_SOURCES.sites, id: site }, { state });
    });
  }

  render(timeS: number): void {
    const result = this.#result;
    if (!result || timeS === this.#lastTimeS) return;
    clearTimeout(this.#pendingFrame);
    const frameWaitMs = this.#frameAtMs + this.#frameIntervalMs - performance.now();
    if (frameWaitMs > 0 && !Number.isNaN(this.#lastTimeS)) {
      this.#pendingFrame = setTimeout(() => {
        this.render(timeS);
      }, frameWaitMs);
      return;
    }
    this.#frameAtMs = performance.now();
    this.#lastTimeS = timeS;

    // Heavy work runs at most every HEAVY_INTERVAL_MS; a trailing update draws the final time
    // when the clock stops between two of them.
    clearTimeout(this.#trailing);
    const now = performance.now();
    const waitMs = this.#heavyAtMs + HEAVY_INTERVAL_MS - now;
    const heavy = waitMs <= 0;
    if (heavy) {
      this.#heavyAtMs = now;
      this.#paintRaster(result, timeS);
      this.#curtains = {
        s: this.#curtain(result.tS, this.#lastArrival.s, result.grid, timeS, S_STYLE),
        p: this.#curtain(result.tP, this.#lastArrival.p, result.grid, timeS, P_STYLE),
      };
    } else {
      this.#trailing = setTimeout(() => {
        this.#heavyAtMs = Number.NEGATIVE_INFINITY;
        this.#lastTimeS = Number.NaN;
        this.render(timeS);
      }, waitMs);
    }
    this.#static ??= this.#staticPositions(result);
    const { extent } = this.#static;
    const curtains = this.#curtains;

    const { rupture } = result;
    const lift = (point: readonly [number, number]): [number, number, number] => [
      point[0],
      point[1],
      this.#groundAt(point[0], point[1]) + RUPTURE_LIFT_M,
    ];
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
      ...(curtains
        ? [curtainLayer('scenario-s-wave', curtains.s), curtainLayer('scenario-p-wave', curtains.p)]
        : []),
      ...this.#stationLayers(result, timeS),
      ...this.#warningLayers(result, timeS),
    ];
    this.#overlay.setProps({ layers });
    this.#updateFacilities(result, timeS);
    this.#updateResponse(result, timeS);
  }

  /** A wavefront curtain, or an empty one once the front has passed the last cell. */
  #curtain(
    arrival: Float32Array,
    lastArrival: number,
    grid: GridSpec,
    timeS: number,
    style: CurtainStyle,
  ): CurtainBuffers {
    if (timeS > lastArrival) return EMPTY_CURTAIN;
    return wavefrontCurtain(arrival, grid, timeS, this.#elevationAt, style);
  }

  #staticPositions(result: SimulationResult): StaticPositions {
    const lift = (point: readonly [number, number]): [number, number, number] => [
      point[0],
      point[1],
      this.#groundAt(point[0], point[1]) + RUPTURE_LIFT_M,
    ];
    return {
      extent: result.rupture.trace.map(lift),
      stations: result.records.stations.map((station) => ({
        station,
        position: [
          station.lon,
          station.lat,
          this.#groundAt(station.lon, station.lat) + STATION_LIFT_M,
        ],
      })),
    };
  }

  #paintRaster(result: SimulationResult, timeS: number): void {
    // A raster on another grid (network, tsunami) needs its own image source.
    if (this.#canvas?.grid !== this.#rasterGrid(result)) this.attach();
    const rasterTimeS = this.#rasterTime(result, timeS);
    if (rasterTimeS === this.#rasterTimeS) return;
    this.#rasterTimeS = rasterTimeS;
    const canvas = this.#canvas;
    if (canvas) {
      const tsunami = this.#tsunami;
      if (this.#raster === 'tsunami' && tsunami) {
        paintTsunami(
          canvas.pixels,
          canvas.rowMap,
          tsunami.result,
          tsunami.cellIndex,
          this.#tsunamiLookup,
          rasterTimeS,
        );
      } else if (this.#raster === 'network' && result.network) {
        paintNetwork(
          canvas.pixels,
          result.regionGrid,
          canvas.rowMap,
          result.network,
          this.#loadLookup,
          rasterTimeS,
        );
      } else {
        paintIntensity(
          canvas.pixels,
          result.grid,
          canvas.rowMap,
          result.tS,
          result.mmi,
          this.#lookup,
          rasterTimeS,
        );
      }
      this.#map.getSource<ImageSource>(INTENSITY_SOURCE)?.updateImage({ image: canvas.image });
    }
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
      this.#elevationAt,
      BLIND_ZONE_STYLE,
    );
    const { lon, lat } = warning.epicenter;
    const estimate: [number, number, number] = [
      lon,
      lat,
      this.#groundAt(lon, lat) + RUPTURE_LIFT_M,
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
    this.#static ??= this.#staticPositions(result);
    const points = this.#static.stations;
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
    clearTimeout(this.#trailing);
    clearTimeout(this.#pendingFrame);
    this.#removeRaster();
    this.#overlay.setProps({ layers: [] });
    this.#result = null;
  }

  #groundAt(lon: number, lat: number): number {
    return Math.max(0, this.#elevationAt?.(lon, lat) ?? 0) * TERRAIN_EXAGGERATION;
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
