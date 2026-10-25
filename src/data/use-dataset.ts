import { useQuery } from '@tanstack/react-query';

import { dataRepository } from './browser';
import type { GridDatasetId, JsonDatasetId } from './repository';

// Prepared datasets never change while the app runs.
const datasetQuery = { staleTime: Number.POSITIVE_INFINITY, gcTime: Number.POSITIVE_INFINITY };

export function useJsonDataset<K extends JsonDatasetId>(id: K) {
  return useQuery({
    ...datasetQuery,
    queryKey: ['data', 'json', id],
    queryFn: () => dataRepository.json(id),
  });
}

export function useGridDataset(id: GridDatasetId) {
  return useQuery({
    ...datasetQuery,
    queryKey: ['data', 'grid', id],
    queryFn: () => dataRepository.grid(id),
  });
}

export function useRoadGraph(enabled = true) {
  return useQuery({
    ...datasetQuery,
    queryKey: ['data', 'roads'],
    queryFn: () => dataRepository.roads(),
    enabled,
  });
}
