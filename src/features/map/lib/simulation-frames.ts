import { blockedDensity } from '@/features/cells';
import { mmiColor } from '@/lib/color/mmi';
import { isolineSegments } from '@/lib/math/isolines';
import type { GridSpec } from '@/types/grid';
import type { NetworkResult } from '@/types/network';
import type { TsunamiResult } from '@/types/tsunami';

/**
 * Per-frame geometry and pixels of a scenario, as pure functions of the simulation result and
 * the clock. `simulation-renderer.ts` hands their output to MapLibre and deck.gl.
 */

const RAD = Math.PI / 180;

function mercatorY(lat: number): number {
  return Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2));
}

/**
 * Grid row for each canvas row. A canvas source is stretched linearly in Web Mercator, while
 * the grid is regular in latitude; without this map the middle rows would drift by about 1 km.
 */
export function mercatorRowMap(spec: GridSpec): Int32Array {
  const south = spec.north - spec.ny * spec.dLat;
  const yNorth = mercatorY(spec.north);
  const ySouth = mercatorY(south);
  const rows = new Int32Array(spec.ny);
  for (let r = 0; r < spec.ny; r++) {
    const y = yNorth + ((r + 0.5) / spec.ny) * (ySouth - yNorth);
    const lat = (2 * Math.atan(Math.exp(y)) - Math.PI / 2) / RAD;
    rows[r] = Math.min(spec.ny - 1, Math.max(0, Math.floor((spec.north - lat) / spec.dLat)));
  }
  return rows;
}

/** Lowest intensity drawn, and the intensity from which the colour is fully opaque. */
export const MIN_DRAWN_MMI = 3;
const FULL_MMI = 4.5;

/** MMI in tenths (0–100) → packed RGBA (little-endian, as an ImageData Uint32 view expects). */
export function mmiLookupTable(maxAlpha = 0.85): Uint32Array {
  const table = new Uint32Array(101);
  for (let i = 0; i <= 100; i++) {
    const mmi = i / 10;
    const [r, g, b] = mmiColor(mmi);
    // Below weak shaking the map stays clear (the event grid ends there, EDGE_MMI in
    // engine/grid/event-grid.ts); the colour is fully established by intensity IV–V.
    const alpha = Math.round(
      Math.min(1, Math.max(0, (mmi - MIN_DRAWN_MMI) / (FULL_MMI - MIN_DRAWN_MMI))) * maxAlpha * 255,
    );
    table[i] = ((alpha << 24) | (b << 16) | (g << 8) | r) >>> 0;
  }
  return table;
}

/** Seconds over which a cell's colour fades in after the S wave arrives. */
export const SHAKING_FADE_S = 1.5;

/** Paints the intensity reached by `timeS`: each cell lights up as the S wave arrives. */
export function paintIntensity(
  pixels: Uint32Array,
  spec: GridSpec,
  rowMap: Int32Array,
  tS: Float32Array,
  mmi: Float32Array,
  lookup: Uint32Array,
  timeS: number,
): void {
  const { nx } = spec;
  for (let r = 0; r < spec.ny; r++) {
    const gridRow = (rowMap[r] ?? 0) * nx;
    const pixelRow = r * nx;
    for (let c = 0; c < nx; c++) {
      const cell = gridRow + c;
      const arrival = tS[cell] ?? Number.POSITIVE_INFINITY;
      if (arrival > timeS) {
        pixels[pixelRow + c] = 0;
        continue;
      }
      const color = lookup[Math.round((mmi[cell] ?? 0) * 10)] ?? 0;
      const fade = Math.min(1, (timeS - arrival) / SHAKING_FADE_S);
      const alpha = Math.round((color >>> 24) * fade);
      pixels[pixelRow + c] = ((alpha << 24) | (color & 0xffffff)) >>> 0;
    }
  }
}

/** Range of the network raster: residents per km² whose calls cannot be carried. */
export const BLOCKED_DENSITY_MIN = 10;
export const BLOCKED_DENSITY_MAX = 10_000;

/**
 * Index 0–255 on the logarithmic load scale for a blocked-call density; below the minimum the
 * cell stays transparent.
 */
export function loadIndex(density: number): number {
  if (!(density > BLOCKED_DENSITY_MIN)) return 0;
  const k =
    Math.log(density / BLOCKED_DENSITY_MIN) / Math.log(BLOCKED_DENSITY_MAX / BLOCKED_DENSITY_MIN);
  return Math.min(255, Math.max(1, Math.round(k * 255)));
}

/**
 * Load scale index → packed RGBA (`LOAD_ANCHORS`, the --load-0 … --load-4 tokens). Index 0 is
 * transparent; colours are opaque enough to read from the first step.
 */
export function loadLookupTable(
  anchors: readonly (readonly [number, number, number])[],
  maxAlpha = 0.9,
): Uint32Array {
  const table = new Uint32Array(256);
  const last = anchors.length - 1;
  for (let i = 1; i < 256; i++) {
    const k = i / 255;
    const position = k * last;
    const low = Math.min(last - 1, Math.floor(position));
    const f = position - low;
    const from = anchors[low] ?? [0, 0, 0];
    const to = anchors[low + 1] ?? from;
    const mix = (channel: 0 | 1 | 2) =>
      Math.round(from[channel] + f * (to[channel] - from[channel]));
    const alpha = Math.round((0.55 + 0.45 * k) * maxAlpha * 255);
    table[i] = ((alpha << 24) | (mix(2) << 16) | (mix(1) << 8) | mix(0)) >>> 0;
  }
  return table;
}

/**
 * Paints, for each cell, the density of residents whose calls its serving site cannot carry at
 * `timeS`, fading in as the S wave reaches the site.
 */
export function paintNetwork(
  pixels: Uint32Array,
  spec: GridSpec,
  rowMap: Int32Array,
  network: NetworkResult,
  lookup: Uint32Array,
  timeS: number,
): void {
  const { nx } = spec;
  const { cellSite } = network;
  for (let r = 0; r < spec.ny; r++) {
    const gridRow = (rowMap[r] ?? 0) * nx;
    const pixelRow = r * nx;
    for (let c = 0; c < nx; c++) {
      const site = cellSite[gridRow + c] ?? -1;
      const arrival = site < 0 ? Number.POSITIVE_INFINITY : (network.siteSArrivalS[site] ?? 0);
      if (arrival > timeS) {
        pixels[pixelRow + c] = 0;
        continue;
      }
      const color = lookup[loadIndex(blockedDensity(network, site, timeS))] ?? 0;
      const fade = Math.min(1, (timeS - arrival) / SHAKING_FADE_S);
      const alpha = Math.round((color >>> 24) * fade);
      pixels[pixelRow + c] = ((alpha << 24) | (color & 0xffffff)) >>> 0;
    }
  }
}

/** Sea-surface elevation at which the tsunami colours saturate, m. */
export const TSUNAMI_SCALE_M = 0.5;
/** Elevation at which a cell becomes fully opaque; calmer water fades out, m. */
const TSUNAMI_OPAQUE_M = 0.25;

/**
 * Sea surface → packed RGBA on the diverging tsunami scale: index 0–255 spans −0.5 m to +0.5 m,
 * hue by sign, opacity rising with |η| so calm water stays clear.
 */
export function tsunamiLookupTable(
  negative: readonly [number, number, number],
  positive: readonly [number, number, number],
  maxAlpha = 0.9,
): Uint32Array {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    const eta = ((i - 127.5) / 127.5) * TSUNAMI_SCALE_M;
    const [r, g, b] = eta < 0 ? negative : positive;
    const alpha = Math.round(Math.min(1, Math.abs(eta) / TSUNAMI_OPAQUE_M) * maxAlpha * 255);
    table[i] = ((alpha << 24) | (b << 16) | (g << 8) | r) >>> 0;
  }
  return table;
}

export function tsunamiIndex(etaM: number): number {
  const k = Math.round(127.5 + (etaM / TSUNAMI_SCALE_M) * 127.5);
  return Math.min(255, Math.max(0, k));
}

/** Index of each grid cell in the tsunami's sea-cell list, -1 on land. */
export function tsunamiCellIndex(result: TsunamiResult): Int32Array {
  const index = new Int32Array(result.grid.nx * result.grid.ny).fill(-1);
  result.wetCells.forEach((cell, k) => {
    index[cell] = k;
  });
  return index;
}

/** Paints the sea surface at `timeS`, interpolated linearly between the stored frames. */
export function paintTsunami(
  pixels: Uint32Array,
  rowMap: Int32Array,
  result: TsunamiResult,
  cellIndex: Int32Array,
  lookup: Uint32Array,
  timeS: number,
): void {
  const { nx, ny } = result.grid;
  const wetCount = result.wetCells.length;
  const position = Math.min(result.frameCount - 1, Math.max(0, timeS / result.frameIntervalS));
  const before = Math.floor(position);
  const after = Math.min(result.frameCount - 1, before + 1);
  const weight = position - before;
  const frames = result.framesMm;
  for (let r = 0; r < ny; r++) {
    const gridRow = (rowMap[r] ?? 0) * nx;
    const pixelRow = r * nx;
    for (let c = 0; c < nx; c++) {
      const k = cellIndex[gridRow + c] ?? -1;
      if (k < 0) {
        pixels[pixelRow + c] = 0;
        continue;
      }
      const a = frames[before * wetCount + k] ?? 0;
      const b = frames[after * wetCount + k] ?? 0;
      pixels[pixelRow + c] = lookup[tsunamiIndex((a + weight * (b - a)) / 1000)] ?? 0;
    }
  }
}

export interface CurtainStyle {
  color: readonly [number, number, number];
  /** Height of each line above the ground, metres (before terrain exaggeration is added). */
  levelsM: readonly number[];
  /** Opacity (0–1) of each level, matching `levelsM`. */
  alphas: readonly number[];
  terrainExaggeration: number;
}

export interface CurtainBuffers {
  length: number;
  sourcePositions: Float32Array;
  targetPositions: Float32Array;
  colors: Uint8Array;
}

/**
 * A wavefront as a 3D curtain of light: the isoline of arrival times at `timeS`, lifted onto the
 * terrain and repeated at several heights with fading opacity.
 */
export function wavefrontCurtain(
  arrival: Float32Array,
  spec: GridSpec,
  timeS: number,
  /** Ground elevation at a point, m (before exaggeration); none on the flat map. */
  elevationAt: ((lon: number, lat: number) => number) | undefined,
  style: CurtainStyle,
): CurtainBuffers {
  const segments = isolineSegments(arrival, spec.nx, spec.ny, timeS);
  const segmentCount = segments.length / 4;
  const levels = style.levelsM.length;
  const length = segmentCount * levels;
  const sourcePositions = new Float32Array(length * 3);
  const targetPositions = new Float32Array(length * 3);
  const colors = new Uint8Array(length * 4);

  const ground = (lon: number, lat: number) =>
    elevationAt ? Math.max(0, elevationAt(lon, lat)) * style.terrainExaggeration : 0;

  let item = 0;
  for (let s = 0; s < segmentCount; s++) {
    const x0 = segments[s * 4] ?? 0;
    const y0 = segments[s * 4 + 1] ?? 0;
    const x1 = segments[s * 4 + 2] ?? 0;
    const y1 = segments[s * 4 + 3] ?? 0;
    const lon0 = spec.west + x0 * spec.dLon;
    const lat0 = spec.north - y0 * spec.dLat;
    const lon1 = spec.west + x1 * spec.dLon;
    const lat1 = spec.north - y1 * spec.dLat;
    const z0 = ground(lon0, lat0);
    const z1 = ground(lon1, lat1);
    for (let level = 0; level < levels; level++) {
      const height = style.levelsM[level] ?? 0;
      sourcePositions.set([lon0, lat0, z0 + height], item * 3);
      targetPositions.set([lon1, lat1, z1 + height], item * 3);
      colors.set([...style.color, Math.round((style.alphas[level] ?? 0) * 255)], item * 4);
      item++;
    }
  }
  return { length, sourcePositions, targetPositions, colors };
}

/**
 * The part of the rupture trace the front has reached by `timeS`. The front spreads both ways
 * from the hypocentre, so the reached part is one stretch with an interpolated tip at each end.
 */
export function rupturedPath(
  trace: readonly (readonly [number, number])[],
  traceTimesS: readonly number[],
  timeS: number,
): [number, number][] {
  const path: [number, number][] = [];
  // A tip that falls exactly on a vertex must not appear twice.
  const add = (point: [number, number]) => {
    const last = path.at(-1);
    if (last?.[0] !== point[0] || last[1] !== point[1]) path.push(point);
  };
  const tip = (i: number, j: number): [number, number] => {
    const a = trace[i] ?? [0, 0];
    const b = trace[j] ?? a;
    const ta = traceTimesS[i] ?? 0;
    const tb = traceTimesS[j] ?? ta;
    const f = tb === ta ? 0 : (timeS - ta) / (tb - ta);
    return [a[0] + f * (b[0] - a[0]), a[1] + f * (b[1] - a[1])];
  };
  for (let i = 0; i < trace.length; i++) {
    const point = trace[i];
    if (!point) continue;
    const reached = (traceTimesS[i] ?? Number.POSITIVE_INFINITY) <= timeS;
    const previousReached = i > 0 && (traceTimesS[i - 1] ?? Number.POSITIVE_INFINITY) <= timeS;
    if (i > 0 && reached !== previousReached) add(tip(i - 1, i));
    if (reached) add([point[0], point[1]]);
  }
  return path;
}
