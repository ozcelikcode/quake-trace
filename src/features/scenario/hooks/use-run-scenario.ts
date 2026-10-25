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
  const ready = Boolean(faults && vs30 && districtCells);

  const run = async (presetId: PresetId) => {
    const preset = SCENARIO_PRESETS.find((candidate) => candidate.id === presetId);
    if (!preset || !faults || !vs30 || !districtCells) return;
    const scenarioStore = useScenarioStore.getState();
    scenarioStore.start(presetId);
    try {
      const result = await simulationWorker().simulate({
        scenario: resolvePreset(preset, faults),
        grid: vs30.spec,
        vs30: vs30.values,
        districtCells: districtCells.values,
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
