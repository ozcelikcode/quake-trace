import { haversineKm } from '@/lib/math/geo';
import { FEED_SOURCES, type FeedEvent, type LiveEvent } from '@/types/live';

/** Reports within these limits describe the same earthquake (memory-bank plan: ±30 s, ±30 km). */
export const SAME_EVENT_S = 30;
export const SAME_EVENT_KM = 30;

export interface Region {
  west: number;
  east: number;
  south: number;
  north: number;
}

export function inRegion(event: FeedEvent, region: Region): boolean {
  return (
    event.lon >= region.west &&
    event.lon <= region.east &&
    event.lat >= region.south &&
    event.lat <= region.north
  );
}

/**
 * Groups reports of the same earthquake across catalogs (greedy, newest first) and takes the
 * values of the preferred catalog (`FEED_SOURCES` order: national agencies first). One catalog
 * never contributes two reports to the same event.
 */
export function mergeReports(reports: readonly FeedEvent[]): LiveEvent[] {
  const sorted = [...reports].sort((a, b) => b.timeMs - a.timeMs);
  const groups: FeedEvent[][] = [];
  for (const report of sorted) {
    const group = groups.find(
      (candidate) =>
        !candidate.some((other) => other.source === report.source) &&
        candidate.some(
          (other) =>
            Math.abs(other.timeMs - report.timeMs) <= SAME_EVENT_S * 1000 &&
            haversineKm(other.lon, other.lat, report.lon, report.lat) <= SAME_EVENT_KM,
        ),
    );
    if (group) group.push(report);
    else groups.push([report]);
  }
  return groups
    .map((group) => {
      const ordered = [...group].sort(
        (a, b) => FEED_SOURCES.indexOf(a.source) - FEED_SOURCES.indexOf(b.source),
      );
      const preferred = ordered[0] ?? group[0];
      if (!preferred) throw new RangeError('empty event group');
      return { ...preferred, id: `${preferred.source}:${preferred.sourceId}`, reports: ordered };
    })
    .sort((a, b) => b.timeMs - a.timeMs);
}
