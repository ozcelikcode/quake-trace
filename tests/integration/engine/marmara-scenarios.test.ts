import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import { valueAt, type Grid } from '@/data/grid';
import { DataRepository, type DataFetcher } from '@/data/repository';
import type {
  Districts,
  DistrictStats,
  Faults,
  Infra,
  Stations,
  Vulnerability,
} from '@/data/schemas';
import { simulate } from '@/engine/sim/simulate';
import { damageInputs } from '@/features/scenario/lib/damage-inputs';
import { resolvePreset, SCENARIO_PRESETS } from '@/features/scenario/lib/presets';
import type { RoadGraph } from '@/types/roads';
import type { SimulationResult } from '@/types/simulation';

import ibb2019 from '../../fixtures/damage/ibb-2019-scenario.json';

const dataDir = fileURLToPath(new URL('../../../public/data/', import.meta.url));
const readFromDisk: DataFetcher = async (path) =>
  new Uint8Array(await readFile(dataDir + path)).buffer;
const repository = new DataRepository(readFromDisk);

let faults: Faults;
let districts: Districts;
let vs30: Grid;
let districtCells: Grid;
let stations: Stations;
let population: Grid;
let districtStats: DistrictStats;
let vulnerability: Vulnerability;
let infra: Infra;
let roads: RoadGraph;

beforeAll(async () => {
  [
    faults,
    districts,
    vs30,
    districtCells,
    stations,
    population,
    districtStats,
    vulnerability,
    infra,
    roads,
  ] = await Promise.all([
    repository.json('faults'),
    repository.json('districts'),
    repository.grid('vs30'),
    repository.grid('districtCells'),
    repository.json('stations'),
    repository.grid('population'),
    repository.json('districtStats'),
    repository.json('vulnerability'),
    repository.json('infra'),
    repository.roads(),
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
    stations: stations.stations.filter((station) => station.accelerometer),
    damage: damageInputs(districtStats, vulnerability, population.values, infra),
    network: { siteLonLat: null },
    roads,
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

  it('records every accelerometer station and triggers each shortly after its P arrival', () => {
    const { records } = run('north-marmara');
    const accelerometers = stations.stations.filter((station) => station.accelerometer);
    expect(records.stations).toHaveLength(accelerometers.length);
    for (const station of records.stations) {
      const lag = (station.triggerS ?? Number.NaN) - station.pArrivalS;
      expect(lag).toBeGreaterThanOrEqual(-0.02);
      expect(lag).toBeLessThan(1);
    }
    const byDistance = [...records.stations].sort((a, b) => a.rjbKm - b.rjbKm);
    const nearest = byDistance[0];
    const farthest = byDistance.at(-1);
    expect(nearest?.pgaCmS2).toBeGreaterThan(5 * (farthest?.pgaCmS2 ?? Number.POSITIVE_INFINITY));
  });

  it.each(SCENARIO_PRESETS.map((p) => p.id))(
    '%s: early warning locates within 5 km and alerts within seconds',
    (id) => {
      const result = run(id);
      const warning = result.earlyWarning;
      expect(warning).not.toBeNull();
      if (!warning) return;
      expect(warning.locationErrorKm).toBeLessThan(5);
      expect(Math.abs(warning.originS)).toBeLessThan(1);
      expect(warning.alertS).toBeGreaterThan(warning.firstTriggerS + 3);
      expect(warning.alertS).toBeLessThan(15);
      // Pd saturates: the first estimate stays below large magnitudes but above 5.5.
      expect(warning.magnitude).toBeGreaterThan(5.5);
      expect(warning.magnitude).toBeLessThan(result.rupture.mw + 0.3);
    },
  );

  it('ranks İstanbul districts like the İBB 2019 scenario and stays within its order of magnitude', () => {
    // İBB 2019: Mw 7.5 on the Main Marmara Fault, night; the preset is a comparable Mw 7.4.
    const result = run('north-marmara');
    const damage = result.damage?.districts ?? [];
    const pairs = ibb2019.districts.map((reference) => {
      const feature = districts.features.find(
        (f) =>
          f.properties.province === 'İstanbul' &&
          f.properties.name.toLocaleLowerCase('tr') === reference.name,
      );
      const modelled = damage.find((d) => d.index === feature?.properties.index);
      if (!modelled) throw new Error(`no district for ${reference.name}`);
      return { reference, modelled };
    });
    expect(pairs).toHaveLength(39);
    expect(
      spearman(
        pairs.map((p) => p.modelled.fatalities),
        pairs.map((p) => p.reference.fatalities),
      ),
    ).toBeGreaterThan(0.65);
    const modelledDeaths = pairs.reduce((sum, p) => sum + p.modelled.fatalities, 0);
    const referenceDeaths = pairs.reduce((sum, p) => sum + p.reference.fatalities, 0);
    expect(modelledDeaths / referenceDeaths).toBeGreaterThan(0.2);
    expect(modelledDeaths / referenceDeaths).toBeLessThan(2);
  });

  it('serves the whole population with synthetic cell sites and congests the shaken area', () => {
    const { network, mmi } = run('north-marmara');
    expect(network?.synthetic).toBe(true);
    if (!network) return;
    // ITU-R M.2135-1 spacing over the region's land: about 33,000 sites.
    expect(network.siteCount).toBeGreaterThan(30_000);
    expect(network.siteCount).toBeLessThan(36_000);
    let landPopulation = 0;
    for (let cell = 0; cell < mmi.length; cell++) {
      if (!Number.isNaN(districtCells.values[cell] ?? Number.NaN)) {
        landPopulation += Math.max(0, population.values[cell] ?? 0);
      }
    }
    const served = network.sitePopulation.reduce((sum, value) => sum + value, 0);
    expect(served / landPopulation).toBeCloseTo(1, 3);
    // Central İstanbul feels intensity VI or more: demand at the 55× peak.
    const fatihCell = (41.01 - 41.8) / -0.01;
    const site = network.cellSite[Math.floor(fatihCell) * 500 + Math.floor((28.95 - 26) / 0.01)];
    expect(network.sitePeakDemand[site ?? -1]).toBe(55);
  });

  it.each(['north-marmara', 'izmit-1999'])(
    '%s: response times grow after the shaking but no İstanbul or Kocaeli district is cut off',
    (id) => {
      const { routing } = run(id);
      expect(routing).not.toBeNull();
      if (!routing) return;
      const provinces = new Set(['İstanbul', 'Kocaeli']);
      // Adalar (the Princes' Islands) has no road link to a hospital; it is reached by sea.
      const inScope = routing.districts.filter((response) => {
        const properties = districts.features[response.index]?.properties;
        return provinces.has(properties?.province ?? '') && properties?.name !== 'Adalar';
      });
      expect(inScope.length).toBe(39 + 12 - 1);
      for (const response of inScope) {
        expect(response.fireAfterMin).toBeGreaterThanOrEqual(response.fireBeforeMin - 1e-9);
        expect(Number.isFinite(response.fireAfterMin)).toBe(true);
        expect(Number.isFinite(response.hospitalAfterMin)).toBe(true);
      }
      expect(inScope.some((response) => response.fireAfterMin > response.fireBeforeMin)).toBe(true);
      expect(routing.corridorEdges.length).toBeGreaterThan(1000);
      expect(Math.max(...routing.corridorUsage)).toBe(1);
    },
  );
});

/** Spearman rank correlation (no tie correction; values are continuous). */
function spearman(a: number[], b: number[]): number {
  const ranks = (values: number[]) => {
    const order = values
      .map((value, index) => ({ value, index }))
      .sort((x, y) => x.value - y.value);
    const result = new Array<number>(values.length).fill(0);
    order.forEach(({ index }, rank) => {
      result[index] = rank;
    });
    return result;
  };
  const ra = ranks(a);
  const rb = ranks(b);
  const mean = (a.length - 1) / 2;
  let covariance = 0;
  let varianceA = 0;
  let varianceB = 0;
  ra.forEach((rank, i) => {
    const da = rank - mean;
    const db = (rb[i] ?? 0) - mean;
    covariance += da * db;
    varianceA += da * da;
    varianceB += db * db;
  });
  return covariance / Math.sqrt(varianceA * varianceB);
}
