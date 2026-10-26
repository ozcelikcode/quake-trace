import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import type { Grid } from '@/data/grid';
import { DataRepository, type DataFetcher } from '@/data/repository';
import type { Faults } from '@/data/schemas';
import { simulate } from '@/engine/sim/simulate';
import { HISTORICAL_EVENTS } from '@/features/replay/lib/historical-events';
import { scenarioFromEvent } from '@/features/scenario/lib/event-scenario';

import observed from '../../fixtures/validation/observed-pga.json';

const dataDir = fileURLToPath(new URL('../../../public/data/', import.meta.url));
const readFromDisk: DataFetcher = async (path) =>
  new Uint8Array(await readFile(dataDir + path)).buffer;
const repository = new DataRepository(readFromDisk);

let faults: Faults;
let vs30: Grid;

beforeAll(async () => {
  [faults, vs30] = await Promise.all([repository.json('faults'), repository.grid('vs30')]);
});

function residuals(eventId: string) {
  const event = HISTORICAL_EVENTS.find((candidate) => candidate.id === eventId);
  const recorded = observed.events.find((candidate) => candidate.event === eventId);
  if (!event || !recorded) throw new Error(`no data for ${eventId}`);
  const result = simulate({
    scenario: scenarioFromEvent(event, faults).scenario,
    grid: vs30.spec,
    vs30: vs30.values,
    stations: recorded.stations.map(({ id, lon, lat }) => ({ id, lon, lat })),
  });
  return recorded.stations.map((station) => {
    const model = result.records.stations.find((s) => s.id === station.id);
    if (!model) throw new Error(`no model value at ${station.id}`);
    return { id: station.id, ln: Math.log(station.pgaCmS2 / model.pgaCmS2) };
  });
}

/**
 * Scientific validation (memory-bank/projectbrief.md, success criteria): the model's median PGA
 * (ASB14 with the USGS Vs30 site term, rupture placed by `scenarioFromEvent`) against PGA
 * observed at KOERI strong-motion stations (geometric mean of the horizontal peaks, flat
 * sensitivity, tests/fixtures/validation). The mean natural-log residual ln(observed/model) must
 * stay within ±0.3. The scatter is reported in memory-bank/simulationModels.md; ASB14's own
 * aleatory variability is of the same order, so single stations are not tested.
 */
describe.each([
  ['replay-silivri-2019', 10],
  ['replay-marmara-2025', 40],
])('observed PGA of %s', (eventId, minimumStations) => {
  it('has a mean ln residual within ±0.3', () => {
    const values = residuals(eventId);
    expect(values.length).toBeGreaterThanOrEqual(minimumStations);
    const mean = values.reduce((sum, value) => sum + value.ln, 0) / values.length;
    expect(Math.abs(mean)).toBeLessThan(0.3);
  });
});
