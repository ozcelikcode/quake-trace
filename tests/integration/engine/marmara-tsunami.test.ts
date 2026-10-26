import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import type { Grid } from '@/data/grid';
import { DataRepository, type DataFetcher } from '@/data/repository';
import type { Districts, Faults } from '@/data/schemas';
import { simulateTsunami } from '@/engine/tsunami/tsunami';
import { resolvePreset, SCENARIO_PRESETS } from '@/features/scenario/lib/presets';
import type { TsunamiResult } from '@/types/tsunami';

const dataDir = fileURLToPath(new URL('../../../public/data/', import.meta.url));
const readFromDisk: DataFetcher = async (path) =>
  new Uint8Array(await readFile(dataDir + path)).buffer;
const repository = new DataRepository(readFromDisk);

let faults: Faults;
let districts: Districts;
let bathymetry: Grid;
let districtCells: Grid;
const results = new Map<string, TsunamiResult>();

beforeAll(async () => {
  [faults, districts, bathymetry, districtCells] = await Promise.all([
    repository.json('faults'),
    repository.json('districts'),
    repository.grid('bathymetry'),
    repository.grid('districtCells'),
  ]);
});

function run(presetId: string): TsunamiResult {
  const cached = results.get(presetId);
  if (cached) return cached;
  const preset = SCENARIO_PRESETS.find((p) => p.id === presetId);
  if (!preset) throw new Error(`no preset ${presetId}`);
  const result = simulateTsunami({
    scenario: resolvePreset(preset, faults),
    bathymetry,
    districtCells,
  });
  results.set(presetId, result);
  return result;
}

function coast(result: TsunamiResult, province: string, name: string) {
  const feature = districts.features.find(
    (f) => f.properties.province === province && f.properties.name === name,
  );
  return result.coast.find((c) => c.index === feature?.properties.index);
}

describe('Marmara tsunami on the prepared bathymetry', () => {
  it.each(['north-marmara', 'izmit-1999'])(
    '%s runs an hour of propagation in the background budget',
    (id) => {
      const result = run(id);
      expect(result.computeMs).toBeLessThan(10_000);
      expect(result.frameCount).toBe(241);
      expect(result.framesMm.length).toBe(241 * result.wetCells.length);
      // Average slip M0 / (μ·A) of a Mw 7.4 rupture over about 2,000 km² is about 2 m.
      expect(result.source.slipM).toBeGreaterThan(1.5);
      expect(result.source.slipM).toBeLessThan(3);
    },
  );

  it('gives the oblique-normal Main Marmara Fault decimetre-scale uplift and subsidence', () => {
    const { source } = run('north-marmara');
    expect(source.maxUpliftM).toBeGreaterThan(0.1);
    expect(source.minUpliftM).toBeLessThan(-0.2);
    // Rake −157°: mostly strike-slip, so the vertical motion stays well below the slip.
    expect(Math.max(source.maxUpliftM, -source.minUpliftM)).toBeLessThan(source.slipM / 2);
  });

  it('reaches the İstanbul coast within minutes and stays within metre scale', () => {
    const result = run('north-marmara');
    const buyukcekmece = coast(result, 'İstanbul', 'Büyükçekmece');
    expect(buyukcekmece?.arrivalS).toBeLessThan(5 * 60);
    expect(buyukcekmece?.maxEtaM).toBeGreaterThan(0.2);
    for (const entry of result.coast) expect(entry.maxEtaM).toBeLessThan(3);
    // The Black Sea coast is sheltered behind the Bosphorus.
    expect(coast(result, 'İstanbul', 'Şile')?.maxEtaM ?? 0).toBeLessThan(0.05);
  });

  it('keeps the 1999-like tsunami strongest inside İzmit Bay', () => {
    const result = run('izmit-1999');
    const top = result.coast
      .slice(0, 5)
      .map((c) => districts.features[c.index]?.properties.province);
    expect(top.every((province) => province === 'Kocaeli' || province === 'Yalova')).toBe(true);
  });
});
