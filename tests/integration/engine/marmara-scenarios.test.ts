import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import { valueAt, type Grid } from '@/data/grid';
import { DataRepository, type DataFetcher } from '@/data/repository';
import type { Districts, Faults } from '@/data/schemas';
import { simulate } from '@/engine/sim/simulate';
import { resolvePreset, SCENARIO_PRESETS } from '@/features/scenario/lib/presets';
import type { SimulationResult } from '@/types/simulation';

const dataDir = fileURLToPath(new URL('../../../public/data/', import.meta.url));
const readFromDisk: DataFetcher = async (path) =>
  new Uint8Array(await readFile(dataDir + path)).buffer;
const repository = new DataRepository(readFromDisk);

let faults: Faults;
let districts: Districts;
let vs30: Grid;
let districtCells: Grid;

beforeAll(async () => {
  [faults, districts, vs30, districtCells] = await Promise.all([
    repository.json('faults'),
    repository.json('districts'),
    repository.grid('vs30'),
    repository.grid('districtCells'),
  ]);
});

function run(presetId: string): SimulationResult {
  const preset = SCENARIO_PRESETS.find((p) => p.id === presetId);
  if (!preset) throw new Error(`no preset ${presetId}`);
  return simulate({
    scenario: resolvePreset(preset, faults),
    grid: vs30.spec,
    vs30: vs30.values,
    districtCells: districtCells.values,
  });
}

function district(result: SimulationResult, name: string) {
  const feature = districts.features.find((f) => f.properties.name === name);
  return result.districts.find((d) => d.index === feature?.properties.index);
}

describe('Marmara scenario presets on the prepared data', () => {
  it.each(SCENARIO_PRESETS.map((p) => p.id))('%s computes within the 2 s budget', (id) => {
    const result = run(id);
    expect(result.computeMs).toBeLessThan(2000);
    expect(result.durationS).toBeGreaterThan(30);
    expect(result.districts.length).toBeGreaterThan(100);
  });

  it('gives the North Marmara rupture a magnitude in the expected range', () => {
    const result = run('north-marmara');
    // About 120 km of the Main Marmara Fault; scenario studies use Mw 7.2–7.6.
    expect(result.rupture.lengthKm).toBeGreaterThan(100);
    expect(result.rupture.lengthKm).toBeLessThan(140);
    expect(result.rupture.mw).toBeGreaterThan(7.2);
    expect(result.rupture.mw).toBeLessThan(7.6);
  });

  it('reaches central İstanbul within seconds and shakes it strongly', () => {
    const result = run('north-marmara');
    const fatih = district(result, 'Fatih');
    expect(fatih?.sArrivalS).toBeLessThan(25);
    expect(fatih?.maxMmi).toBeGreaterThan(6.5);
    // Shaking weakens with distance: Edirne's centre is far from the fault.
    expect(district(result, 'Merkez')?.maxMmi ?? 10).toBeLessThan(fatih?.maxMmi ?? 0);
  });

  it('keeps the 1999-like scenario strongest around İzmit Bay', () => {
    const result = run('izmit-1999');
    const atGolcuk = valueAt({ spec: result.grid, values: result.mmi }, 29.82, 40.72);
    const atIstanbul = valueAt({ spec: result.grid, values: result.mmi }, 28.95, 41.01);
    // A median model: VIII near the fault. Observed 1999 intensities reached IX–X, which lie
    // within the model's aleatory variability (σ ≈ 0.7 in ln PGA).
    expect(atGolcuk).toBeGreaterThan(7.5);
    expect(atGolcuk).toBeGreaterThan(atIstanbul);
  });
});
