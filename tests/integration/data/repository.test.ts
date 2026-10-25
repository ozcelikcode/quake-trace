import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { valueAt } from '@/data/grid';
import { DataRepository, jsonDatasets, type DataFetcher } from '@/data/repository';

const dataDir = fileURLToPath(new URL('../../../public/data/', import.meta.url));

/** Reads the committed datasets from disk, as the browser would fetch them. */
const readFromDisk: DataFetcher = async (path) =>
  new Uint8Array(await readFile(dataDir + path)).buffer;

const repository = new DataRepository(readFromDisk);

describe('prepared datasets', () => {
  it('have a valid manifest', async () => {
    const manifest = await repository.manifest();
    expect(manifest.grids['marmara-1km']).toMatchObject({ nx: 500, ny: 200 });
    expect(Object.keys(manifest.datasets)).toEqual(
      expect.arrayContaining([...Object.keys(jsonDatasets), 'population', 'vs30', 'roads']),
    );
  });

  it.each(Object.keys(jsonDatasets) as (keyof typeof jsonDatasets)[])(
    'validate %s against its schema',
    async (id) => {
      await expect(repository.json(id)).resolves.toBeDefined();
    },
  );

  it('keep district indices and statistics aligned', async () => {
    const districts = await repository.json('districts');
    const stats = await repository.json('districtStats');
    expect(districts.features.map((f) => f.properties.index)).toEqual(
      stats.districts.map((d) => d.index),
    );
    expect(districts.features.filter((f) => f.properties.province === 'İstanbul')).toHaveLength(39);
  });

  it('decode grids with the same orientation as the pipeline', async () => {
    const population = await repository.grid('population');
    const bathymetry = await repository.grid('bathymetry');
    const districtCells = await repository.grid('districtCells');
    const districts = await repository.json('districts');

    expect(valueAt(population, 28.95, 41.01)).toBeGreaterThan(5000); // Fatih
    expect(valueAt(bathymetry, 29.0, 40.75)).toBeLessThan(-1000); // Çınarcık Basin
    const kadikoy = districts.features[valueAt(districtCells, 29.03, 40.99)];
    expect(kadikoy?.properties.name).toBe('Kadıköy');
  });

  it('decode a consistent road graph', async () => {
    const graph = await repository.roads();
    expect(graph.edgeOffsets[graph.nodeCount]).toBe(graph.edgeCount);
    let maxTarget = 0;
    for (const target of graph.edgeTargets) maxTarget = Math.max(maxTarget, target);
    expect(maxTarget).toBeLessThan(graph.nodeCount);
    expect(graph.classes).toEqual(['motorway', 'trunk', 'primary', 'secondary', 'tertiary']);
  });

  it('treat cell sites as optional', async () => {
    const manifest = await repository.manifest();
    const cells = await repository.cells();
    expect(cells === undefined).toBe(manifest.datasets.cells === undefined);
  });
});
