import { describe, expect, it } from 'vitest';

import { populationExposure } from '@/engine/exposure/population-exposure';
import type { GridSpec } from '@/types/grid';

// A 2 × 2 shaking grid over a 4 × 1 population strip; the last population cell lies outside.
const grid: GridSpec = { west: 0, north: 2, dLon: 1, dLat: 1, nx: 2, ny: 2 };
const populationGrid: GridSpec = { west: 0, north: 1, dLon: 1, dLat: 1, nx: 4, ny: 1 };

describe('population exposure (PAGER-style)', () => {
  it('counts residents per rounded intensity class from MMI III, per province', () => {
    const exposure = populationExposure({
      grid,
      mmi: Float32Array.from([9, 9, 6.4, 2.6]),
      populationGrid,
      population: Float32Array.from([100, 50, 1000, 7]),
      province: Float32Array.from([0, 1, 1, 1]),
    });
    expect(exposure?.populationByMmi[6]).toBe(100);
    // 2.6 rounds to III and is counted; the cell outside the shaking grid is not.
    expect(exposure?.populationByMmi[3]).toBe(50);
    expect(exposure?.populationByMmi.reduce((a, b) => a + b)).toBe(150);
    expect(exposure?.provinces.map((p) => p.index)).toEqual([0, 1]);
    expect(exposure?.provinces[0]?.maxMmi).toBeCloseTo(6.4, 5);
  });

  it('is null when no populated cell is shaken', () => {
    expect(
      populationExposure({
        grid,
        mmi: new Float32Array(4).fill(1),
        populationGrid,
        population: Float32Array.from([1, 1, 1, 1]),
        province: new Float32Array(4),
      }),
    ).toBeNull();
  });
});
