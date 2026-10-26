/** Earthquake catalogs read in live mode, in the order their values are preferred. */
export const FEED_SOURCES = ['afad', 'kandilli', 'emsc', 'usgs'] as const;
export type FeedSource = (typeof FEED_SOURCES)[number];

/** One catalog's report of an earthquake. */
export interface FeedEvent {
  source: FeedSource;
  sourceId: string;
  /** Origin time, ms since the Unix epoch (UTC). */
  timeMs: number;
  lon: number;
  lat: number;
  depthKm: number;
  magnitude: number;
  magnitudeType: string;
  place: string;
}

/** An earthquake as reported by one or more catalogs, with the preferred report's values. */
export interface LiveEvent extends FeedEvent {
  /** Stable key: preferred source and its id. */
  id: string;
  reports: FeedEvent[];
}
