import { useEffect, useMemo, useState } from 'react';

import { useJsonDataset } from '@/data/use-dataset';
import { useScenarioStore } from '@/state/scenario-store';

import type { ReferenceData } from '../lib/reference-layers';

const WORLD_FAULTS_DELAY_MS = 1500;

export function useReferenceData(): ReferenceData {
  const districts = useJsonDataset('districts').data;
  const faults = useJsonDataset('faults').data;
  // The world catalogue (about 450 KB) waits until the first view has loaded.
  const [later, setLater] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      setLater(true);
    }, WORLD_FAULTS_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, []);
  const worldFaults = useJsonDataset('worldFaults', later).data;
  const stations = useJsonDataset('stations').data?.stations;
  // Facilities matter once a scenario gives them a state; the 780 KB file waits until then.
  const hasResult = useScenarioStore((state) => state.result !== null);
  const infra = useJsonDataset('infra', hasResult).data;
  return useMemo(
    () => ({ districts, faults, worldFaults, stations, infra }),
    [districts, faults, worldFaults, stations, infra],
  );
}
