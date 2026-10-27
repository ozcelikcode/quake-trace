import { z } from 'zod';

import { DataError } from './errors';
import type { Grid } from './grid';

/** `public/data/vs30-world/index.json` (pipeline `vs30_world.py`). */
export const vs30TileIndexSchema = z.object({
  tileDeg: z.number().positive(),
  cellDeg: z.number().positive(),
  tileCells: z.number().int().positive(),
  encoding: z.object({
    minVs30: z.number().positive(),
    maxVs30: z.number().positive(),
    levels: z.literal(255),
  }),
  tiles: z.array(z.string()),
});
export type Vs30TileIndex = z.infer<typeof vs30TileIndexSchema>;

export interface LonLatBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

/** Tile name from its south-west corner, as the pipeline writes it (`N40E020`, `S10W080`). */
export function tileName(south: number, west: number): string {
  const lat = `${south >= 0 ? 'N' : 'S'}${String(Math.abs(south)).padStart(2, '0')}`;
  const lon = `${west >= 0 ? 'E' : 'W'}${String(Math.abs(west)).padStart(3, '0')}`;
  return lat + lon;
}

/** Wraps a longitude into [-180, 180). */
export function wrapLon(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

/** Names of the existing tiles that cover a box (longitudes may run past ±180). */
export function tilesCovering(index: Vs30TileIndex, bounds: LonLatBounds): string[] {
  const { tileDeg } = index;
  const available = new Set(index.tiles);
  const names = new Set<string>();
  const south = Math.max(-90, Math.floor(bounds.south / tileDeg) * tileDeg);
  const north = Math.min(90, bounds.north);
  // Wide boxes cover every longitude once.
  const span = Math.min(360, bounds.east - bounds.west);
  const firstWest = Math.floor(bounds.west / tileDeg) * tileDeg;
  for (let lat = south; lat < north; lat += tileDeg) {
    for (let lon = firstWest; lon < bounds.west + span; lon += tileDeg) {
      const name = tileName(lat, wrapLon(lon));
      if (available.has(name)) names.add(name);
    }
  }
  return [...names];
}

/** South-west corner of a tile from its name. */
function tileCorner(name: string): { south: number; west: number } {
  const match = /^([NS])(\d{2})([EW])(\d{3})$/.exec(name);
  if (!match) throw new DataError(`bad Vs30 tile name ${name}`);
  const [, ns, lat = '0', ew, lon = '0'] = match;
  return {
    south: (ns === 'S' ? -1 : 1) * Number(lat),
    west: (ew === 'W' ? -1 : 1) * Number(lon),
  };
}

async function gunzip(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).arrayBuffer();
}

/**
 * A tile as a Vs30 grid: one byte per cell, north-up; code c > 0 is
 * minVs30 · (maxVs30 / minVs30)^((c − 1) / 254), code 0 is no data (NaN).
 */
export async function decodeVs30Tile(
  name: string,
  gzipped: ArrayBuffer,
  index: Vs30TileIndex,
): Promise<Grid> {
  const codes = new Uint8Array(await gunzip(gzipped));
  const { tileCells, tileDeg, cellDeg, encoding } = index;
  if (codes.length !== tileCells * tileCells) {
    throw new DataError(`Vs30 tile ${name} has ${String(codes.length)} cells`);
  }
  const ratio = Math.log(encoding.maxVs30 / encoding.minVs30) / 254;
  const table = new Float32Array(256);
  table[0] = Number.NaN;
  for (let code = 1; code < 256; code++)
    table[code] = encoding.minVs30 * Math.exp((code - 1) * ratio);
  const values = new Float32Array(codes.length);
  for (let i = 0; i < codes.length; i++) values[i] = table[codes[i] ?? 0] ?? Number.NaN;
  const { south, west } = tileCorner(name);
  return {
    spec: {
      west,
      north: south + tileDeg,
      dLon: cellDeg,
      dLat: cellDeg,
      nx: tileCells,
      ny: tileCells,
    },
    values,
  };
}
