import { gzipSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import {
  decodeVs30Tile,
  tileName,
  tilesCovering,
  wrapLon,
  type Vs30TileIndex,
} from '@/data/vs30-tiles';

const index: Vs30TileIndex = {
  tileDeg: 10,
  cellDeg: 5,
  tileCells: 2,
  encoding: { minVs30: 100, maxVs30: 2000, levels: 255 },
  tiles: ['N40E020', 'N30E020', 'N40W180', 'S10W080'],
};

describe('worldwide Vs30 tiles', () => {
  it('names tiles by their south-west corner like the pipeline', () => {
    expect(tileName(40, 20)).toBe('N40E020');
    expect(tileName(-10, -80)).toBe('S10W080');
    expect(wrapLon(185)).toBe(-175);
    expect(wrapLon(-180)).toBe(-180);
  });

  it('lists the existing tiles under a box, across the antimeridian', () => {
    expect(tilesCovering(index, { west: 22, south: 35, east: 28, north: 45 }).sort()).toEqual([
      'N30E020',
      'N40E020',
    ]);
    expect(tilesCovering(index, { west: 175, south: 41, east: 185, north: 42 })).toEqual([
      'N40W180',
    ]);
  });

  it('decodes the logarithmic byte scale, zero as no data', async () => {
    const codes = Uint8Array.from([0, 1, 255, 128]);
    const gzipped = gzipSync(codes);
    const buffer = gzipped.buffer.slice(
      gzipped.byteOffset,
      gzipped.byteOffset + gzipped.byteLength,
    ) as ArrayBuffer;
    const grid = await decodeVs30Tile('N40E020', buffer, index);
    expect(grid.spec).toEqual({ west: 20, north: 50, dLon: 5, dLat: 5, nx: 2, ny: 2 });
    expect(grid.values[0]).toBeNaN();
    expect(grid.values[1]).toBeCloseTo(100, 3);
    expect(grid.values[2]).toBeCloseTo(2000, 1);
    expect(grid.values[3]).toBeCloseTo(100 * 20 ** (127 / 254), 1);
  });
});
