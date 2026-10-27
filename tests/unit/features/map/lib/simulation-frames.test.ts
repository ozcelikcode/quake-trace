import { describe, expect, it } from 'vitest';

import { LOAD_ANCHORS, TSUNAMI_NEG, TSUNAMI_POS } from '@/features/map/lib/layer-palette';
import {
  BLOCKED_DENSITY_MAX,
  BLOCKED_DENSITY_MIN,
  loadIndex,
  loadLookupTable,
  mercatorRowMap,
  MIN_DRAWN_MMI,
  mmiLookupTable,
  paintIntensity,
  paintNetwork,
  paintTsunami,
  TSUNAMI_SCALE_M,
  tsunamiCellIndex,
  tsunamiIndex,
  tsunamiLookupTable,
  rupturedPath,
  SHAKING_FADE_S,
  wavefrontCurtain,
} from '@/features/map/lib/simulation-frames';
import { EDGE_MMI } from '@/engine/grid/event-grid';
import type { GridSpec } from '@/types/grid';
import type { NetworkResult } from '@/types/network';
import type { TsunamiResult } from '@/types/tsunami';

const spec: GridSpec = { west: 26, north: 41.8, dLon: 0.01, dLat: 0.01, nx: 4, ny: 200 };

describe('simulation frames', () => {
  it('maps Mercator canvas rows onto latitude rows monotonically', () => {
    const rows = mercatorRowMap(spec);
    expect(rows[0]).toBe(0);
    expect(rows[spec.ny - 1]).toBe(spec.ny - 1);
    for (let r = 1; r < spec.ny; r++) expect(rows[r]).toBeGreaterThanOrEqual(rows[r - 1] ?? 0);
    // Mercator stretches the north, so the middle canvas row lies north of the middle latitude.
    expect(rows[100]).toBeLessThan(100);
  });

  it('keeps weak shaking transparent', () => {
    const table = mmiLookupTable();
    expect((table[10] ?? 0) >>> 24).toBe(0);
    // The event grid ends where intensity falls below the drawn range, so no edge shows.
    expect(MIN_DRAWN_MMI).toBe(EDGE_MMI);
    expect((table[MIN_DRAWN_MMI * 10] ?? 0) >>> 24).toBe(0);
    expect((table[80] ?? 0) >>> 24).toBeGreaterThan(200);
  });

  it('paints cells only after the S wave arrives, fading in', () => {
    const small: GridSpec = { west: 0, north: 1, dLon: 1, dLat: 1, nx: 2, ny: 1 };
    const pixels = new Uint32Array(2);
    const tS = Float32Array.from([1, 10]);
    const mmi = Float32Array.from([8, 8]);
    const table = mmiLookupTable();
    paintIntensity(pixels, small, Int32Array.from([0]), tS, mmi, table, 1 + SHAKING_FADE_S);
    expect(pixels[0]).toBe(table[80]);
    expect(pixels[1]).toBe(0);
  });

  it('builds one curtain line per isoline segment and level, rising with the level', () => {
    const grid: GridSpec = { west: 0, north: 3, dLon: 1, dLat: 1, nx: 3, ny: 3 };
    const arrival = Float32Array.from([1, 2, 3, 1, 2, 3, 1, 2, 3]);
    const curtain = wavefrontCurtain(arrival, grid, 1.5, undefined, {
      color: [0, 128, 255],
      levelsM: [100, 500],
      alphas: [1, 0.5],
      terrainExaggeration: 1.5,
    });
    expect(curtain.length).toBe(2 * 2);
    expect(curtain.sourcePositions[2]).toBe(100);
    expect(curtain.sourcePositions[5]).toBe(500);
    expect(Array.from(curtain.colors.slice(4, 8))).toEqual([0, 128, 255, 128]);
  });

  it('grows the ruptured stretch both ways from the hypocentre', () => {
    const trace: [number, number][] = [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
    ];
    const times = [3, 1, 2, 4];
    expect(rupturedPath(trace, times, 0.5)).toEqual([]);
    expect(rupturedPath(trace, times, 2)).toEqual([
      [0.5, 0],
      [1, 0],
      [2, 0],
    ]);
    expect(rupturedPath(trace, times, 3)).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
      [2.5, 0],
    ]);
  });
});

describe('network raster', () => {
  it('maps blocked-call density onto the load scale logarithmically from 10 to 10,000 per km²', () => {
    const table = loadLookupTable(LOAD_ANCHORS);
    expect(loadIndex(BLOCKED_DENSITY_MIN)).toBe(0);
    expect(loadIndex(Number.NaN)).toBe(0);
    expect(loadIndex(100)).toBe(85);
    expect(loadIndex(BLOCKED_DENSITY_MAX)).toBe(255);
    expect(loadIndex(1e6)).toBe(255);
    expect(table[0]).toBe(0);
    const [r, g, b] = LOAD_ANCHORS.at(-1) ?? [0, 0, 0];
    expect(table[255]).toBe(((Math.round(0.9 * 255) << 24) | (b << 16) | (g << 8) | r) >>> 0);
  });

  it('paints each cell with its serving site once the S wave has reached it', () => {
    const tiny: GridSpec = { west: 0, north: 0.01, dLon: 0.01, dLat: 0.01, nx: 3, ny: 1 };
    const network: NetworkResult = {
      synthetic: true,
      siteCount: 2,
      siteLonLat: new Float32Array(4),
      sitePopulation: new Float32Array(2),
      siteDensity: Float32Array.from([1e6, 1e6]),
      siteSArrivalS: Float32Array.from([1, 100]),
      sitePeakDemand: Float32Array.from([55, 55]),
      siteLossRatio: Float32Array.from([0, 0]),
      cellSite: Int32Array.from([0, 1, -1]),
      decayS: 1e9,
    };
    const pixels = new Uint32Array(3);
    const table = loadLookupTable(LOAD_ANCHORS);
    paintNetwork(pixels, tiny, Int32Array.from([0]), network, table, 10);
    expect(pixels[0]).toBe(table[255]);
    expect(pixels[1]).toBe(0);
    expect(pixels[2]).toBe(0);
  });
});

describe('tsunami raster', () => {
  it('maps the sea surface onto the diverging scale, calm water clear', () => {
    const table = tsunamiLookupTable(TSUNAMI_NEG, TSUNAMI_POS);
    expect(tsunamiIndex(0)).toBe(128);
    expect(tsunamiIndex(-TSUNAMI_SCALE_M)).toBe(0);
    expect(tsunamiIndex(5)).toBe(255);
    expect((table[128] ?? 0) >>> 24).toBeLessThan(10);
    expect((table[255] ?? 0) & 0xff).toBe(TSUNAMI_POS[0]);
    expect((table[0] ?? 0) & 0xff).toBe(TSUNAMI_NEG[0]);
  });

  it('interpolates between frames on the sea cells', () => {
    const grid: GridSpec = { west: 0, north: 0.01, dLon: 0.01, dLat: 0.01, nx: 2, ny: 1 };
    const result: TsunamiResult = {
      scenarioId: 'test',
      durationS: 10,
      frameIntervalS: 10,
      frameCount: 2,
      grid,
      wetCells: Int32Array.from([1]),
      framesMm: Int16Array.from([0, 400]),
      maxEtaM: Float32Array.from([0.4]),
      arrivalS: Float32Array.from([0]),
      coast: [],
      source: { slipM: 1, maxUpliftM: 0, minUpliftM: 0 },
      computeMs: 0,
    };
    const table = tsunamiLookupTable(TSUNAMI_NEG, TSUNAMI_POS);
    const pixels = new Uint32Array(2);
    paintTsunami(pixels, Int32Array.from([0]), result, tsunamiCellIndex(result), table, 5);
    expect(pixels[0]).toBe(0);
    expect(pixels[1]).toBe(table[tsunamiIndex(0.2)]);
  });
});
