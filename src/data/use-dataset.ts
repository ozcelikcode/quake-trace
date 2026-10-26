import { useQuery } from '@tanstack/react-query';

import { dataRepository } from './browser';
import type { GridDatasetId, JsonDatasetId } from './repository';

// Prepared datasets never change while the app runs.
const datasetQuery = { staleTime: Number.POSITIVE_INFINITY, gcTime: Number.POSITIVE_INFINITY };

/** The prepared-data manifest (versions and sources of every dataset). */
export function useManifest() {
  return useQuery({
    ...datasetQuery,
    queryKey: ['data', 'manifest'],
    queryFn: () => dataRepository.manifest(),
  });
}

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

/** Cell sites, or undefined when no OpenCelliD data was built. */
export function useCellSites() {
  return useQuery({
    ...datasetQuery,
    queryKey: ['data', 'cells'],
    // Query data cannot be undefined, so a missing dataset is stored as null.
    queryFn: async () => (await dataRepository.cells()) ?? null,
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
