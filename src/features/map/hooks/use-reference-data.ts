import { useMemo } from 'react';

import { useJsonDataset } from '@/data/use-dataset';
import { useScenarioStore } from '@/state/scenario-store';

import type { ReferenceData } from '../lib/reference-layers';

export function useReferenceData(): ReferenceData {
  const districts = useJsonDataset('districts').data;
  const faults = useJsonDataset('faults').data;
  const stations = useJsonDataset('stations').data?.stations;
  // Facilities matter once a scenario gives them a state; the 780 KB file waits until then.
  const hasResult = useScenarioStore((state) => state.result !== null);
  const infra = useJsonDataset('infra', hasResult).data;
  return useMemo(
    () => ({ districts, faults, stations, infra }),
    [districts, faults, stations, infra],
  );
}
