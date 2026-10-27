import { queryOptions, useQuery } from '@tanstack/react-query';

import { dataRepository } from './browser';
import type { GridDatasetId, JsonDatasetId } from './repository';

// Prepared datasets never change while the app runs.
const datasetQuery = { staleTime: Number.POSITIVE_INFINITY, gcTime: Number.POSITIVE_INFINITY };

/*
 * Query options are shared by the hooks and by imperative loads (`queryClient.query`),
 * so a dataset fetched for a run is the same cache entry the panels read.
 */

export const jsonDatasetQuery = <K extends JsonDatasetId>(id: K) =>
  queryOptions({
    ...datasetQuery,
    queryKey: ['data', 'json', id],
    queryFn: () => dataRepository.json(id),
  });

export const gridDatasetQuery = (id: GridDatasetId) =>
  queryOptions({
    ...datasetQuery,
    queryKey: ['data', 'grid', id],
    queryFn: () => dataRepository.grid(id),
  });

export const roadGraphQuery = () =>
  queryOptions({
    ...datasetQuery,
    queryKey: ['data', 'roads'],
    queryFn: () => dataRepository.roads(),
  });

/** Cell sites, or null when no OpenCelliD data was built (query data cannot be undefined). */
export const cellSitesQuery = () =>
  queryOptions({
    ...datasetQuery,
    queryKey: ['data', 'cells'],
    queryFn: async () => (await dataRepository.cells()) ?? null,
  });

/** The prepared-data manifest (versions and sources of every dataset). */
export function useManifest() {
  return useQuery({
    ...datasetQuery,
    queryKey: ['data', 'manifest'],
    queryFn: () => dataRepository.manifest(),
  });
}

/** A JSON dataset; `enabled: false` defers the download until it is needed. */
export function useJsonDataset<K extends JsonDatasetId>(id: K, enabled = true) {
  return useQuery({ ...jsonDatasetQuery(id), enabled });
}

export function useGridDataset(id: GridDatasetId, enabled = true) {
  return useQuery({ ...gridDatasetQuery(id), enabled });
}

export function useRoadGraph(enabled = true) {
  return useQuery({ ...roadGraphQuery(), enabled });
}
