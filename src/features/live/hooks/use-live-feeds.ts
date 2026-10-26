import { useQueries, type UseQueryResult } from '@tanstack/react-query';
import { useEffect } from 'react';

import { fetchFeed } from '@/data/feeds/client';
import { mergeReports } from '@/data/feeds/merge';
import { useLiveStore } from '@/state/live-store';
import { FEED_SOURCES, type FeedEvent, type FeedSource, type LiveEvent } from '@/types/live';

/** The catalogs update within a minute; the proxy caches for 30 s. */
const POLL_MS = 60_000;

export interface FeedStatus {
  source: FeedSource;
  status: 'pending' | 'error' | 'success';
  updatedAt: number;
  count: number;
}

/** Stable, so TanStack Query recomputes it only when a feed result changes. */
function combine(results: UseQueryResult<FeedEvent[]>[]) {
  return {
    events: mergeReports(results.flatMap((result) => result.data ?? [])),
    feeds: FEED_SOURCES.map((source, i): FeedStatus => ({
      source,
      status: results[i]?.status ?? 'pending',
      updatedAt: results[i]?.dataUpdatedAt ?? 0,
      count: results[i]?.data?.length ?? 0,
    })),
  };
}

/**
 * Polls the four catalogs while `enabled`, merges their reports into events and shares them with
 * the map through the live store. A failing catalog does not hide the others.
 */
export function useLiveFeeds(enabled: boolean): { events: LiveEvent[]; feeds: FeedStatus[] } {
  const result = useQueries({
    queries: FEED_SOURCES.map((source) => ({
      queryKey: ['live', source],
      queryFn: () => fetchFeed(source, Date.now()),
      enabled,
      refetchInterval: POLL_MS,
      staleTime: POLL_MS / 2,
      retry: 1,
    })),
    combine,
  });
  const setEvents = useLiveStore((state) => state.setEvents);
  useEffect(() => {
    setEvents(enabled ? result.events : []);
    return () => {
      setEvents([]);
    };
  }, [enabled, result.events, setEvents]);
  return result;
}
