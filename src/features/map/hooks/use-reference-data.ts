import { useMemo } from 'react';

import { useJsonDataset } from '@/data/use-dataset';

import type { ReferenceData } from '../lib/reference-layers';

export function useReferenceData(): ReferenceData {
  const districts = useJsonDataset('districts').data;
  const faults = useJsonDataset('faults').data;
  const stations = useJsonDataset('stations').data?.stations;
  const infra = useJsonDataset('infra').data;
  return useMemo(
    () => ({ districts, faults, stations, infra }),
    [districts, faults, stations, infra],
  );
}
