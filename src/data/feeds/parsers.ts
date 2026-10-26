import { z } from 'zod';

import type { FeedEvent } from '@/types/live';

/**
 * Parsers for the live earthquake catalogs (memory-bank/dataSources.md, "Runtime services").
 * Every response is validated with a schema before it is trusted; entries that fail are dropped
 * rather than failing the whole feed.
 */

const usgsSchema = z.object({
  features: z.array(
    z.object({
      id: z.string(),
      geometry: z.object({ coordinates: z.tuple([z.number(), z.number(), z.number()]) }),
      properties: z.object({
        time: z.number(),
        mag: z.number().nullable(),
        magType: z.string().nullable(),
        place: z.string().nullable(),
      }),
    }),
  ),
});

/** USGS FDSN event service, GeoJSON (time in ms, depth in km). */
export function parseUsgs(json: unknown): FeedEvent[] {
  return usgsSchema.parse(json).features.flatMap(({ id, geometry, properties }) => {
    const [lon, lat, depthKm] = geometry.coordinates;
    if (properties.mag === null) return [];
    return [
      {
        source: 'usgs' as const,
        sourceId: id,
        timeMs: properties.time,
        lon,
        lat,
        depthKm,
        magnitude: properties.mag,
        magnitudeType: properties.magType ?? '',
        place: properties.place ?? '',
      },
    ];
  });
}

const emscSchema = z.object({
  features: z.array(
    z.object({
      id: z.string(),
      properties: z.object({
        time: z.iso.datetime({ offset: true }),
        lat: z.number(),
        lon: z.number(),
        depth: z.number(),
        mag: z.number(),
        magtype: z.string(),
        flynn_region: z.string(),
      }),
    }),
  ),
});

/** EMSC seismicportal FDSN event service, `format=json` (GeoJSON with ISO times). */
export function parseEmsc(json: unknown): FeedEvent[] {
  return emscSchema.parse(json).features.map(({ id, properties }) => ({
    source: 'emsc' as const,
    sourceId: id,
    timeMs: Date.parse(properties.time),
    lon: properties.lon,
    lat: properties.lat,
    depthKm: properties.depth,
    magnitude: properties.mag,
    magnitudeType: properties.magtype.toUpperCase(),
    place: properties.flynn_region,
  }));
}

const numeric = z
  .string()
  .regex(/^-?\d+(\.\d+)?$/)
  .transform(Number);
const afadSchema = z.array(
  z.object({
    eventID: z.string(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
    latitude: numeric,
    longitude: numeric,
    depth: numeric,
    magnitude: numeric,
    type: z.string(),
    location: z.string(),
  }),
);

/**
 * AFAD apiv2 `event/filter`: numbers arrive as strings and dates without a zone; the dates are
 * UTC (they match EMSC's UTC times for the same events).
 */
export function parseAfad(json: unknown): FeedEvent[] {
  return afadSchema.parse(json).map((event) => ({
    source: 'afad' as const,
    sourceId: event.eventID,
    timeMs: Date.parse(`${event.date}Z`),
    lon: event.longitude,
    lat: event.latitude,
    depthKm: event.depth,
    magnitude: event.magnitude,
    magnitudeType: event.type,
    place: event.location,
  }));
}

/** Türkiye has kept UTC+3 all year since 2016; Kandilli lists local time. */
const KANDILLI_UTC_OFFSET_MS = 3 * 3600 * 1000;
const KANDILLI_LINE =
  /^(\d{4})\.(\d{2})\.(\d{2}) (\d{2}):(\d{2}):(\d{2})\s+(-?[\d.]+)\s+(-?[\d.]+)\s+([\d.]+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.+?)\s{2,}\S.*$/u;

/**
 * Kandilli `lst0.asp`: a fixed-width list inside <pre>, decoded from Windows-1254. The magnitude
 * is Mw when given, otherwise ML, otherwise MD ("-.-" marks a missing value).
 */
export function parseKandilli(text: string): FeedEvent[] {
  const events: FeedEvent[] = [];
  for (const line of text.split(/\r?\n/)) {
    const match = KANDILLI_LINE.exec(line);
    if (!match) continue;
    const [, year, month, day, hour, minute, second, lat, lon, depth, md, ml, mw, place] = match;
    const magnitudes: [string, string | undefined][] = [
      ['Mw', mw],
      ['ML', ml],
      ['MD', md],
    ];
    const chosen = magnitudes.find(([, value]) => value !== undefined && value !== '-.-');
    if (!chosen) continue;
    const timeMs =
      Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second),
      ) - KANDILLI_UTC_OFFSET_MS;
    events.push({
      source: 'kandilli',
      sourceId: `${year ?? ''}${month ?? ''}${day ?? ''}${hour ?? ''}${minute ?? ''}${second ?? ''}`,
      timeMs,
      lon: Number(lon),
      lat: Number(lat),
      depthKm: Number(depth),
      magnitude: Number(chosen[1]),
      magnitudeType: chosen[0],
      place: (place ?? '').trim(),
    });
  }
  return events;
}
