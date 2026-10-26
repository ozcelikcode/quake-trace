import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import { DataRepository, type DataFetcher } from '@/data/repository';
import type { Districts } from '@/data/schemas';
import { simulate } from '@/engine/sim/simulate';
import { districtRows, toCsv, toGeoJson } from '@/features/events/lib/district-export';
import { eventLog } from '@/features/events/lib/event-log';
import { damageInputs } from '@/features/scenario/lib/damage-inputs';
import { resolvePreset, SCENARIO_PRESETS } from '@/features/scenario/lib/presets';
import type { RoadGraph } from '@/types/roads';
import type { SimulationResult } from '@/types/simulation';

const dataDir = fileURLToPath(new URL('../../../public/data/', import.meta.url));
const readFromDisk: DataFetcher = async (path) =>
  new Uint8Array(await readFile(dataDir + path)).buffer;
const repository = new DataRepository(readFromDisk);

let result: SimulationResult;
let districts: Districts;
let roads: RoadGraph;

beforeAll(async () => {
  const [faults, vs30, districtCells, stations, population, districtStats, vulnerability, infra] =
    await Promise.all([
      repository.json('faults'),
      repository.grid('vs30'),
      repository.grid('districtCells'),
      repository.json('stations'),
      repository.grid('population'),
      repository.json('districtStats'),
      repository.json('vulnerability'),
      repository.json('infra'),
    ]);
  [districts, roads] = await Promise.all([repository.json('districts'), repository.roads()]);
  const preset = SCENARIO_PRESETS.find((p) => p.id === 'north-marmara');
  if (!preset) throw new Error('no preset');
  result = simulate({
    scenario: resolvePreset(preset, faults),
    grid: vs30.spec,
    vs30: vs30.values,
    districtCells: districtCells.values,
    stations: stations.stations.filter((station) => station.accelerometer),
    damage: damageInputs(districtStats, vulnerability, population.values, infra),
    network: { siteLonLat: null },
    roads,
  });
}, 30_000);

describe('event log and exports of the North Marmara preset', () => {
  it('orders the milestones in time: origin, detection, alert, then the S wave in İstanbul', () => {
    const log = eventLog(result, null, districts, roads);
    const times = log.map((entry) => entry.timeS);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    const index = (id: string) => log.findIndex((entry) => entry.id === id);
    expect(index('origin')).toBe(0);
    expect(index('detection')).toBeLessThan(index('alert'));
    const istanbul = log.find((entry) => entry.id === 's-İstanbul');
    expect(istanbul?.kind).toBe('sArrival');
    // The alert comes at T+6–11 s; the S wave is already in İstanbul's nearest district.
    expect(istanbul?.timeS).toBeLessThan(15);
    expect(log.find((entry) => entry.kind === 'strongest')).toMatchObject({ tone: 'critical' });
  });

  it('logs facility losses, congestion and every M ≥ 5 aftershock', () => {
    const log = eventLog(result, null, districts, roads);
    expect(log.some((entry) => entry.kind === 'networkCongested')).toBe(true);
    const aftershocks = log.filter((entry) => entry.kind === 'aftershock');
    const m5 = Array.from(result.aftershocks.magnitude).filter((m) => m >= 5).length;
    expect(aftershocks).toHaveLength(m5);
    expect(m5).toBeGreaterThan(0);
  });

  it('exports one row per reached district, with outlines, rupture and epicentre', () => {
    const rows = districtRows(result, null, districts);
    expect(rows).toHaveLength(result.districts.length);
    const fatih = rows.find((row) => row.name === 'Fatih');
    expect(fatih?.province).toBe('İstanbul');
    expect(fatih?.mmi).toBeGreaterThan(6.5);
    expect(fatih?.tsunami_arrival_s).toBeNull();
    const meta = { scenarioId: 'north-marmara', url: 'x', generatedAt: 'y', disclaimer: 'z' };
    const geojson = toGeoJson(result, rows, districts, meta);
    expect(geojson.simulation).toBe(true);
    expect(geojson.features).toHaveLength(rows.length + 2);
    expect(geojson.features[0]?.geometry.type).toBe('Point');
    expect(toCsv(rows).split('\r\n')).toHaveLength(rows.length + 2);
  });
});
