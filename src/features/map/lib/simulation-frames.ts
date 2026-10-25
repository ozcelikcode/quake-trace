import { mmiColor } from '@/lib/color/mmi';
import { isolineSegments } from '@/lib/math/isolines';
import type { GridSpec } from '@/types/grid';

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

/** MMI in tenths (0–100) → packed RGBA (little-endian, as an ImageData Uint32 view expects). */
export function mmiLookupTable(maxAlpha = 0.85): Uint32Array {
  const table = new Uint32Array(101);
  for (let i = 0; i <= 100; i++) {
    const mmi = i / 10;
    const [r, g, b] = mmiColor(mmi);
    // Barely felt shaking stays transparent; the colour is fully established by intensity IV–V.
    const alpha = Math.round(Math.min(1, Math.max(0, (mmi - 2) / 2.5)) * maxAlpha * 255);
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
  elevationM: Float32Array | undefined,
  style: CurtainStyle,
): CurtainBuffers {
  const segments = isolineSegments(arrival, spec.nx, spec.ny, timeS);
  const segmentCount = segments.length / 4;
  const levels = style.levelsM.length;
  const length = segmentCount * levels;
  const sourcePositions = new Float32Array(length * 3);
  const targetPositions = new Float32Array(length * 3);
  const colors = new Uint8Array(length * 4);

  const ground = (x: number, y: number) => {
    if (!elevationM) return 0;
    const col = Math.min(spec.nx - 1, Math.max(0, Math.floor(x)));
    const row = Math.min(spec.ny - 1, Math.max(0, Math.floor(y)));
    return Math.max(0, elevationM[row * spec.nx + col] ?? 0) * style.terrainExaggeration;
  };

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
    const z0 = ground(x0, y0);
    const z1 = ground(x1, y1);
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
