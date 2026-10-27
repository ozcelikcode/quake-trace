import type { FeedEvent, FeedSource } from '@/types/live';

import { inRegion, type Region } from './merge';
import { parseAfad, parseEmsc, parseKandilli, parseUsgs } from './parsers';

/**
 * Requests for the live catalogs. USGS and EMSC send CORS headers and are called directly; AFAD
 * and Kandilli go through the Worker proxy (`/api/…`, worker/upstreams.ts).
 */

/**
 * Türkiye and its margins: AFAD, Kandilli and EMSC report every located shock here. USGS covers
 * the world from `WORLD_MIN_MAGNITUDE`; smaller shocks elsewhere would flood the list.
 */
const TURKEY_REGION: Region = { west: 25, east: 45, south: 35.5, north: 42.5 };
const WORLD_MIN_MAGNITUDE = 4.5;
const LIVE_WINDOW_DAYS = 7;
const DAY_MS = 86_400_000;

export type Fetcher = (url: string) => Promise<Response>;

/** ISO time without milliseconds or zone, as AFAD and the FDSN services accept it. */
function isoSeconds(ms: number): string {
  return new Date(ms).toISOString().slice(0, 19);
}

export function feedUrl(source: FeedSource, nowMs: number): string {
  const start = isoSeconds(nowMs - LIVE_WINDOW_DAYS * DAY_MS);
  const region = TURKEY_REGION;
  const box = (names: [string, string, string, string]) =>
    `${names[0]}=${String(region.south)}&${names[1]}=${String(region.north)}&${names[2]}=${String(region.west)}&${names[3]}=${String(region.east)}`;
  const min = String(WORLD_MIN_MAGNITUDE);
  switch (source) {
    case 'usgs':
      return `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${start}&minmagnitude=${min}`;
    case 'emsc':
      return `https://www.seismicportal.eu/fdsnws/event/1/query?format=json&start=${start}&${box(['minlat', 'maxlat', 'minlon', 'maxlon'])}&limit=500`;
    case 'afad':
      return `/api/afad/event/filter?start=${start}&end=${isoSeconds(nowMs + DAY_MS)}&${box(['minlat', 'maxlat', 'minlon', 'maxlon'])}&orderby=timedesc`;
    case 'kandilli':
      return '/api/kandilli/lst0.asp';
  }
}

function checked(response: Response): Response {
  if (!response.ok) throw new Error(`HTTP ${String(response.status)}`);
  return response;
}

/** Whether a catalog's report belongs in the list: the world for USGS, Türkiye for the rest. */
function inCoverage(source: FeedSource, event: FeedEvent): boolean {
  return source === 'usgs'
    ? event.magnitude >= WORLD_MIN_MAGNITUDE
    : inRegion(event, TURKEY_REGION);
}

/** Reports of one catalog inside its coverage and the time window. */
export async function fetchFeed(
  source: FeedSource,
  nowMs: number,
  fetcher: Fetcher = (url) => fetch(url),
): Promise<FeedEvent[]> {
  const response = checked(await fetcher(feedUrl(source, nowMs)));
  let events: FeedEvent[];
  switch (source) {
    case 'usgs':
      events = parseUsgs(await response.json());
      break;
    case 'emsc':
      events = parseEmsc(await response.json());
      break;
    case 'afad':
      events = parseAfad(await response.json());
      break;
    case 'kandilli':
      // Kandilli serves Windows-1254 without declaring it.
      events = parseKandilli(new TextDecoder('windows-1254').decode(await response.arrayBuffer()));
      break;
  }
  const since = nowMs - LIVE_WINDOW_DAYS * DAY_MS;
  return events.filter((event) => event.timeMs >= since && inCoverage(source, event));
}
