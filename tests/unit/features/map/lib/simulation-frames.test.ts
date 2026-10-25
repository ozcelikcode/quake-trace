import { describe, expect, it } from 'vitest';

import {
  mercatorRowMap,
  mmiLookupTable,
  paintIntensity,
  rupturedPath,
  SHAKING_FADE_S,
  wavefrontCurtain,
} from '@/features/map/lib/simulation-frames';
import type { GridSpec } from '@/types/grid';

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
