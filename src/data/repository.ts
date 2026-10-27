import type { z } from 'zod';

import type { RoadGraph } from '@/types/roads';

import { decodeCellSites, type CellSites } from './cell-sites';
import { DataError } from './errors';
import { decodeGrid, type Grid } from './grid';
import { manifestSchema, type DatasetEntry, type Manifest } from './manifest';
import { decodeRoadGraph } from './road-graph';
import {
  decodeVs30Tile,
  tilesCovering,
  vs30TileIndexSchema,
  type LonLatBounds,
  type Vs30TileIndex,
} from './vs30-tiles';
import {
  districtStatsSchema,
  districtsSchema,
  faultsSchema,
  infraSchema,
  stationsSchema,
  vulnerabilitySchema,
} from './schemas';

/**
 * Reads a file from public/data by its manifest path; `version` (the dataset's sha256) lets the
 * fetcher address an immutable copy.
 */
export type DataFetcher = (path: string, version?: string) => Promise<ArrayBuffer>;

export const jsonDatasets = {
  faults: faultsSchema,
  districts: districtsSchema,
  districtStats: districtStatsSchema,
  stations: stationsSchema,
  infra: infraSchema,
  vulnerability: vulnerabilitySchema,
} as const;

export type JsonDatasetId = keyof typeof jsonDatasets;
export type JsonDataset<K extends JsonDatasetId> = z.infer<(typeof jsonDatasets)[K]>;

// A mapped type lets TypeScript correlate each id with its parser's return type.
const parsers: { [K in JsonDatasetId]: (value: unknown) => JsonDataset<K> } = {
  faults: (value) => jsonDatasets.faults.parse(value),
  districts: (value) => jsonDatasets.districts.parse(value),
  districtStats: (value) => jsonDatasets.districtStats.parse(value),
  stations: (value) => jsonDatasets.stations.parse(value),
  infra: (value) => jsonDatasets.infra.parse(value),
  vulnerability: (value) => jsonDatasets.vulnerability.parse(value),
};
export type GridDatasetId = 'population' | 'vs30' | 'bathymetry' | 'districtCells' | 'elevation';

const decoder = new TextDecoder();

function parseJson(buffer: ArrayBuffer): unknown {
  return JSON.parse(decoder.decode(buffer));
}

/**
 * Loads prepared datasets listed in the manifest and validates them. The manifest is fetched
 * once; each dataset is fetched on demand (callers cache results, e.g. with TanStack Query).
 */
export class DataRepository {
  readonly #fetcher: DataFetcher;
  #manifest: Promise<Manifest> | undefined;
  #vs30Index: Promise<{ index: Vs30TileIndex; directory: string; version: string }> | undefined;
  /** Decoded tiles, kept for the next scenario nearby. */
  readonly #vs30Tiles = new Map<string, Promise<Grid>>();

  constructor(fetcher: DataFetcher) {
    this.#fetcher = fetcher;
  }

  manifest(): Promise<Manifest> {
    this.#manifest ??= this.#fetcher('manifest.json').then((buffer) =>
      manifestSchema.parse(parseJson(buffer)),
    );
    return this.#manifest;
  }

  async entry(id: string): Promise<DatasetEntry | undefined> {
    return (await this.manifest()).datasets[id];
  }

  async #require(id: string): Promise<DatasetEntry> {
    const entry = await this.entry(id);
    if (!entry) throw new DataError(`dataset ${id} is not in the manifest`);
    return entry;
  }

  async json<K extends JsonDatasetId>(id: K): Promise<JsonDataset<K>> {
    const entry = await this.#require(id);
    const parse = parsers[id];
    return parse(parseJson(await this.#fetcher(entry.path, entry.sha256)));
  }

  async grid(id: GridDatasetId): Promise<Grid> {
    const manifest = await this.manifest();
    const entry = await this.#require(id);
    if (entry.format !== 'float32-grid') throw new DataError(`dataset ${id} is not a grid`);
    const spec = manifest.grids[entry.grid];
    if (!spec) throw new DataError(`grid ${entry.grid} is not in the manifest`);
    return decodeGrid(await this.#fetcher(entry.path, entry.sha256), spec);
  }

  async roads(): Promise<RoadGraph> {
    const entry = await this.#require('roads');
    if (entry.format !== 'csr-graph') throw new DataError('roads is not a graph');
    return decodeRoadGraph(await this.#fetcher(entry.path, entry.sha256), entry);
  }

  /**
   * Worldwide Vs30 tiles covering a box, as grids. Tiles are stored gzipped in the repository
   * and decoded here.
   */
  async vs30Tiles(bounds: LonLatBounds): Promise<Grid[]> {
    this.#vs30Index ??= this.#require('vs30World').then(async (entry) => {
      if (entry.format !== 'vs30-tiles') throw new DataError('vs30World is not a tile set');
      const index = vs30TileIndexSchema.parse(
        parseJson(await this.#fetcher(entry.path, entry.sha256)),
      );
      return { index, directory: entry.path.replace(/[^/]+$/, ''), version: entry.sha256 };
    });
    const { index, directory, version } = await this.#vs30Index;
    return Promise.all(
      tilesCovering(index, bounds).map((name) => {
        let tile = this.#vs30Tiles.get(name);
        if (!tile) {
          tile = this.#fetcher(`${directory}${name}.u8.gz`, version).then((buffer) =>
            decodeVs30Tile(name, buffer, index),
          );
          this.#vs30Tiles.set(name, tile);
        }
        return tile;
      }),
    );
  }

  /** Cell sites are optional: they need an OpenCelliD key at build time. */
  async cells(): Promise<CellSites | undefined> {
    const entry = await this.entry('cells');
    if (!entry) return undefined;
    if (entry.format !== 'binary-table') throw new DataError('cells is not a binary table');
    return decodeCellSites(await this.#fetcher(entry.path, entry.sha256), entry);
  }
}
