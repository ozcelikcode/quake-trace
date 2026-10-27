import { useQueryClient, type QueryClient } from '@tanstack/react-query';

import {
  cellSitesQuery,
  gridDatasetQuery,
  jsonDatasetQuery,
  roadGraphQuery,
  useJsonDataset,
} from '@/data/use-dataset';
import { fetchObservedRecords } from '@/data/feeds/waveforms';
import type { Stations } from '@/data/schemas';
import { haversineKm } from '@/lib/math/geo';
import { useObservedStore, type ObservedComponents } from '@/state/observed-store';
import { usePlaybackStore } from '@/state/playback-store';
import { useScenarioStore, type ScenarioOrigin } from '@/state/scenario-store';
import { useTsunamiStore } from '@/state/tsunami-store';
import type { Scenario, ScenarioEvent } from '@/types/scenario';
import { simulationWorker } from '@/workers/simulation-client';
import { tsunamiWorker } from '@/workers/tsunami-client';

import { customScenario } from '../lib/custom-scenario';
import { damageInputs } from '../lib/damage-inputs';
import { scenarioFromEvent } from '../lib/event-scenario';
import { resolvePreset, SCENARIO_PRESETS } from '../lib/presets';
import { encodeRunRequest, type RunRequest } from '../lib/run-request';

/**
 * Observed records are looked for at the accelerometer stations within this distance; waveforms
 * come from the nearest ones that were operating at the origin time (`fetchObservedRecords`).
 * The 2019 Mw 5.7 Silivri earthquake still reached 1.9 cm/s² at KO.GPA, 188 km away
 * (tests/fixtures/validation).
 */
const OBSERVED_RADIUS_KM = 200;

/** Fetches real records of the nearest stations; telemetry shows them over the synthetic ones. */
async function loadObserved(
  scenarioId: string,
  event: ScenarioEvent,
  stations: Stations,
  durationS: number,
  sampleRateHz: number,
) {
  const observed = useObservedStore.getState();
  observed.start(scenarioId);
  const nearest = stations.stations
    .filter((station) => station.accelerometer)
    .map((station) => ({
      id: station.id,
      distanceKm: haversineKm(event.lon, event.lat, station.lon, station.lat),
    }))
    .filter((station) => station.distanceKm <= OBSERVED_RADIUS_KM)
    .sort((a, b) => a.distanceKm - b.distanceKm);
  try {
    const records =
      nearest.length === 0
        ? []
        : await fetchObservedRecords({
            stationIds: nearest.map((station) => station.id),
            originMs: event.originMs,
            durationS,
            sampleRateHz,
          });
    const byStation: Record<string, ObservedComponents> = {};
    for (const record of records) byStation[record.stationId] = record.components;
    useObservedStore.getState().succeed(scenarioId, byStation);
  } catch (error) {
    console.error(error);
    useObservedStore.getState().fail(scenarioId);
  }
}

/**
 * Propagates the scenario's tsunami in its own worker and opens the tsunami timeline scale when
 * it is done; a result for an older scenario is dropped. The bathymetry is fetched only here.
 */
async function runTsunami(queryClient: QueryClient, scenario: Scenario) {
  const token = useTsunamiStore.getState().start();
  try {
    const [bathymetry, districtCells] = await Promise.all([
      queryClient.query(gridDatasetQuery('bathymetry')),
      queryClient.query(gridDatasetQuery('districtCells')),
    ]);
    const result = await tsunamiWorker().simulate({ scenario, bathymetry, districtCells });
    if (useTsunamiStore.getState().succeed(token, result)) {
      usePlaybackStore.getState().setExtent('tsunami', result.durationS);
    }
  } catch (error) {
    console.error(error);
    useTsunamiStore.getState().fail(token);
  }
}

/** Everything the simulation worker needs, fetched in parallel on the first run and cached. */
function loadSimulationInputs(queryClient: QueryClient) {
  const ensure = queryClient.query.bind(queryClient);
  return Promise.all([
    ensure(gridDatasetQuery('vs30')),
    ensure(gridDatasetQuery('districtCells')),
    ensure(gridDatasetQuery('population')),
    ensure(jsonDatasetQuery('stations')),
    ensure(jsonDatasetQuery('districtStats')),
    ensure(jsonDatasetQuery('vulnerability')),
    ensure(jsonDatasetQuery('infra')),
    ensure(roadGraphQuery()),
    ensure(cellSitesQuery()),
  ]);
}

/** Puts the request in the address bar, so the page URL always shares the running scenario. */
function publishRequest(request: RunRequest) {
  const { pathname, hash } = window.location;
  window.history.replaceState(
    null,
    '',
    `${pathname}?${encodeRunRequest(request).toString()}${hash}`,
  );
}

/**
 * Runs a preset, an editor draft, a replay or a live event in the simulation worker, starts
 * playback, then computes its tsunami and, for real earthquakes, fetches the observed records.
 */
export function useRunScenario() {
  const queryClient = useQueryClient();
  // Requests are resolved against the fault catalogue (24 KB); the heavy inputs load on the
  // first run, so opening the page downloads none of them.
  const faults = useJsonDataset('faults').data;
  const ready = Boolean(faults);

  const run = async (request: RunRequest) => {
    if (!faults) return;
    const scenarioStore = useScenarioStore.getState();
    let scenario: Scenario;
    let origin: ScenarioOrigin;
    try {
      if (request.kind === 'preset') {
        const preset = SCENARIO_PRESETS.find((candidate) => candidate.id === request.id);
        if (!preset) return;
        scenario = resolvePreset(preset, faults);
        origin = { kind: 'preset' };
      } else if (request.kind === 'custom') {
        scenario = customScenario(request.draft, faults);
        origin = { kind: 'custom', faultId: request.draft.faultId, seed: request.draft.seed };
      } else {
        const placed = scenarioFromEvent(request.event, faults);
        scenario = placed.scenario;
        origin = {
          kind: request.kind,
          originMs: request.event.originMs,
          magnitude: request.event.magnitude,
          place: request.event.place,
          catalog: request.event.catalog,
          faultId: placed.faultId,
          faultDistanceKm: placed.faultDistanceKm,
          placement: placed.placement,
        };
      }
    } catch (error) {
      console.error(error);
      scenarioStore.fail('compute');
      return;
    }
    scenarioStore.start(scenario.id, origin);
    publishRequest(request);
    useObservedStore.getState().clear();
    try {
      const [
        vs30,
        districtCells,
        population,
        stations,
        districtStats,
        vulnerability,
        infra,
        roads,
        cells,
      ] = await loadSimulationInputs(queryClient);
      const result = await simulationWorker().simulate({
        scenario,
        grid: vs30.spec,
        vs30: vs30.values,
        districtCells: districtCells.values,
        // Strong-motion records come from the stations with accelerometers.
        stations: stations.stations
          .filter((station) => station.accelerometer)
          .map(({ id, lon, lat }) => ({ id, lon, lat })),
        damage: damageInputs(districtStats, vulnerability, population.values, infra),
        // Without OpenCelliD data the engine places synthetic sites.
        network: { siteLonLat: cells?.siteLonLat ?? null },
        roads,
      });
      scenarioStore.succeed(result);
      usePlaybackStore.getState().load(result.durationS, result.aftershocks.durationS);
      void runTsunami(queryClient, scenario);
      if (request.kind === 'replay' || request.kind === 'event') {
        void loadObserved(
          scenario.id,
          request.event,
          stations,
          result.durationS,
          result.records.sampleRateHz,
        );
      }
    } catch (error) {
      console.error(error);
      scenarioStore.fail('compute');
    }
  };

  return { run, ready };
}
