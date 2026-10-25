import { useGridDataset, useJsonDataset } from '@/data/use-dataset';
import { usePlaybackStore } from '@/state/playback-store';
import { useScenarioStore } from '@/state/scenario-store';
import { simulationWorker } from '@/workers/simulation-client';

import { resolvePreset, SCENARIO_PRESETS, type PresetId } from '../lib/presets';

/** Runs a preset in the simulation worker and starts playback of the result. */
export function useRunScenario() {
  const faults = useJsonDataset('faults').data;
  const vs30 = useGridDataset('vs30').data;
  const districtCells = useGridDataset('districtCells').data;
  const stations = useJsonDataset('stations').data;
  const ready = Boolean(faults && vs30 && districtCells && stations);

  const run = async (presetId: PresetId) => {
    const preset = SCENARIO_PRESETS.find((candidate) => candidate.id === presetId);
    if (!preset || !faults || !vs30 || !districtCells || !stations) return;
    const scenarioStore = useScenarioStore.getState();
    scenarioStore.start(presetId);
    try {
      const result = await simulationWorker().simulate({
        scenario: resolvePreset(preset, faults),
        grid: vs30.spec,
        vs30: vs30.values,
        districtCells: districtCells.values,
        // Strong-motion records come from the stations with accelerometers.
        stations: stations.stations
          .filter((station) => station.accelerometer)
          .map(({ id, lon, lat }) => ({ id, lon, lat })),
      });
      scenarioStore.succeed(result);
      usePlaybackStore.getState().load(result.durationS);
    } catch (error) {
      console.error(error);
      scenarioStore.fail(error instanceof Error ? error.message : String(error));
    }
  };

  return { run, ready };
}
