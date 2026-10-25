import { describe, expect, it } from 'vitest';

import { DataError } from '@/data/errors';
import { decodeGrid, valueAt } from '@/data/grid';
import type { GridSpec } from '@/data/manifest';

const spec: GridSpec = {
  west: 26,
  north: 41,
  dLon: 0.5,
  dLat: 0.5,
  nx: 4,
  ny: 2,
  rowOrder: 'north-to-south',
  encoding: 'float32-le',
};

describe('grid decoding', () => {
  it('rejects buffers whose size does not match the grid', () => {
    expect(() => decodeGrid(new ArrayBuffer(12), spec)).toThrow(DataError);
  });

  it('reads values and returns NaN outside the grid', () => {
    const grid = decodeGrid(new Float32Array([0, 1, 2, 3, 4, 5, 6, 7]).buffer, spec);
    expect(valueAt(grid, 26.6, 40.9)).toBe(1);
    expect(valueAt(grid, 27.6, 40.2)).toBe(7);
    expect(valueAt(grid, 10, 10)).toBeNaN();
  });
});
