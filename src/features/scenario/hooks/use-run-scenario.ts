import { useCellSites, useGridDataset, useJsonDataset, useRoadGraph } from '@/data/use-dataset';
import type { Grid } from '@/data/grid';
import { usePlaybackStore } from '@/state/playback-store';
import { useScenarioStore } from '@/state/scenario-store';
import { useTsunamiStore } from '@/state/tsunami-store';
import type { Scenario } from '@/types/scenario';
import { simulationWorker } from '@/workers/simulation-client';
import { tsunamiWorker } from '@/workers/tsunami-client';

import { damageInputs } from '../lib/damage-inputs';
import { resolvePreset, SCENARIO_PRESETS, type PresetId } from '../lib/presets';

/**
 * Propagates the scenario's tsunami in its own worker and opens the tsunami timeline scale when
 * it is done; a result for an older scenario is dropped.
 */
async function runTsunami(scenario: Scenario, bathymetry: Grid, districtCells: Grid) {
  const token = useTsunamiStore.getState().start();
  try {
    const result = await tsunamiWorker().simulate({ scenario, bathymetry, districtCells });
    if (useTsunamiStore.getState().succeed(token, result)) {
      usePlaybackStore.getState().setExtent('tsunami', result.durationS);
    }
  } catch (error) {
    console.error(error);
    useTsunamiStore.getState().fail(token);
  }
}

/** Runs a preset in the simulation worker, starts playback, then computes its tsunami. */
export function useRunScenario() {
  const faults = useJsonDataset('faults').data;
  const vs30 = useGridDataset('vs30').data;
  const districtCells = useGridDataset('districtCells').data;
  const stations = useJsonDataset('stations').data;
  const districtStats = useJsonDataset('districtStats').data;
  const vulnerability = useJsonDataset('vulnerability').data;
  const infra = useJsonDataset('infra').data;
  const population = useGridDataset('population').data;
  const bathymetry = useGridDataset('bathymetry').data;
  const roads = useRoadGraph().data;
  const cells = useCellSites();
  const ready = Boolean(
    roads &&
    cells.isSuccess &&
    faults &&
    vs30 &&
    districtCells &&
    stations &&
    districtStats &&
    vulnerability &&
    infra &&
    population &&
    bathymetry,
  );

  const run = async (presetId: PresetId) => {
    const preset = SCENARIO_PRESETS.find((candidate) => candidate.id === presetId);
    if (
      !preset ||
      !faults ||
      !vs30 ||
      !districtCells ||
      !stations ||
      !districtStats ||
      !vulnerability ||
      !infra ||
      !population ||
      !bathymetry ||
      !roads ||
      !cells.isSuccess
    ) {
      return;
    }
    const scenarioStore = useScenarioStore.getState();
    scenarioStore.start(presetId);
    const scenario = resolvePreset(preset, faults);
    try {
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
        network: { siteLonLat: cells.data?.siteLonLat ?? null },
        roads,
      });
      scenarioStore.succeed(result);
      usePlaybackStore.getState().load(result.durationS);
      void runTsunami(scenario, bathymetry, districtCells);
    } catch (error) {
      console.error(error);
      scenarioStore.fail(error instanceof Error ? error.message : String(error));
    }
  };

  return { run, ready };
}
