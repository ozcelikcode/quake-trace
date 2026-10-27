import { useMemo } from 'react';

import { useJsonDataset, useRoadGraph } from '@/data/use-dataset';
import { useScenarioStore } from '@/state/scenario-store';
import { useTsunamiStore } from '@/state/tsunami-store';

import { eventLog } from '../lib/event-log';

/** The current scenario's result, its tsunami (once computed) and its event log. */
export function useEventLog() {
  const result = useScenarioStore((state) => state.result);
  const tsunami = useTsunamiStore((state) =>
    state.result?.scenarioId === result?.scenarioId ? state.result : null,
  );
  const districts = useJsonDataset('districts').data;
  const roads = useRoadGraph(result !== null).data;
  const entries = useMemo(
    () => (result && districts ? eventLog(result, tsunami, districts, roads) : []),
    [result, tsunami, districts, roads],
  );
  return { result, tsunami, districts, roads, entries };
}
