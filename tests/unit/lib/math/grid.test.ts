import { describe, expect, it } from 'vitest';

import { cellIndex } from '@/lib/math/grid';
import type { GridSpec } from '@/types/grid';

const spec: GridSpec = { west: 26, north: 41, dLon: 0.5, dLat: 0.5, nx: 4, ny: 2 };

describe('grid cell lookup', () => {
  it('indexes cells north-up, west to east', () => {
    expect(cellIndex(spec, 26.1, 40.9)).toBe(0);
    expect(cellIndex(spec, 27.9, 40.1)).toBe(7);
    expect(cellIndex(spec, 25.9, 40.5)).toBe(-1);
    expect(cellIndex(spec, 27, 41.1)).toBe(-1);
  });
});
