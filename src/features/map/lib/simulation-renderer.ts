import type { Layer } from '@deck.gl/core';
import { LineLayer, PathLayer, ScatterplotLayer } from '@deck.gl/layers';
import type { MapLibreOverlay } from '@deck.gl/maplibre';
import type { ImageSource, Map as MapLibreMap } from 'maplibre-gl';

import type { GridSpec } from '@/types/grid';
import type { SimulationResult } from '@/types/simulation';

import { overlayAnchorLayerId } from './layer-order';
import { TERRAIN_EXAGGERATION } from './map-config';
import {
  mercatorRowMap,
  mmiLookupTable,
  paintIntensity,
  rupturedPath,
  wavefrontCurtain,
  type CurtainBuffers,
  type CurtainStyle,
} from './simulation-frames';

/**
 * Draws a scenario at a given time: the intensity raster as a MapLibre canvas source (draped on
 * the terrain, below the reference lines) and the wavefronts, rupture and epicentre as deck.gl
 * layers lifted onto the terrain with the elevation grid.
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
  #result: SimulationResult | null = null;
  #elevation: Float32Array | undefined;
  #image: ImageData | null = null;
  #pixels: Uint32Array | null = null;
  #rowMap: Int32Array | null = null;
  #lastTimeS = Number.NaN;

  constructor(map: MapLibreMap, overlay: MapLibreOverlay) {
    this.#map = map;
    this.#overlay = overlay;
  }

  /** Ground elevation on the result's grid (m), used to lift 3D elements onto the terrain. */
  setElevation(values: Float32Array | undefined): void {
    this.#elevation = values;
    this.#lastTimeS = Number.NaN;
  }

  setResult(result: SimulationResult | null): void {
    this.#result = result;
    this.#lastTimeS = Number.NaN;
    this.#removeRaster();
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
    this.#map.addLayer(
      {
        id: INTENSITY_LAYER,
        type: 'raster',
        source: INTENSITY_SOURCE,
        paint: { 'raster-opacity': 0.8, 'raster-resampling': 'linear', 'raster-fade-duration': 0 },
      },
      below,
    );
    this.#lastTimeS = Number.NaN;
  }

  render(timeS: number): void {
    const result = this.#result;
    if (!result || timeS === this.#lastTimeS) return;
    this.#lastTimeS = timeS;

    if (this.#pixels && this.#rowMap && this.#image) {
      paintIntensity(
        this.#pixels,
        result.grid,
        this.#rowMap,
        result.tS,
        result.mmi,
        this.#lookup,
        timeS,
      );
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
    ];
    this.#overlay.setProps({ layers });
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
