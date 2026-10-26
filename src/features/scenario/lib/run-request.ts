import { z } from 'zod';

import { HISTORICAL_EVENTS } from '@/features/replay';
import type { ScenarioDraft, ScenarioEvent } from '@/types/scenario';

import { SCENARIO_PRESETS, type PresetId } from './presets';

/** What to simulate: a preset, an editor draft, a historical replay or a live catalog event. */
export type RunRequest =
  | { kind: 'preset'; id: PresetId }
  | { kind: 'custom'; draft: ScenarioDraft }
  | { kind: 'replay' | 'event'; event: ScenarioEvent };

/**
 * Share links carry the request as readable query parameters, so a link can be read and edited
 * by hand:
 *
 *   ?preset=north-marmara
 *   ?replay=replay-kocaeli-1999
 *   ?fault=TRCF045&mw=7.2&hypo=120&depth=9&seed=1
 *   ?event=<id>&time=<ISO 8601>&lon=…&lat=…&depth=…&mag=…&place=…&catalog=…
 *
 * Every parameter is validated with zod before it reaches the engine; ranges are the ones the
 * editor and the catalogs produce.
 */

const presetIds = SCENARIO_PRESETS.map((preset) => preset.id) as [PresetId, ...PresetId[]];
const number = (min: number, max: number) => z.coerce.number().min(min).max(max);

const presetSchema = z.object({ preset: z.enum(presetIds) });
const replaySchema = z.object({ replay: z.string() });
const customSchema = z.object({
  fault: z.string().regex(/^[A-Z0-9]{3,12}$/),
  mw: number(4, 9),
  hypo: number(0, 2000),
  depth: number(0, 50),
  seed: z.coerce
    .number()
    .int()
    .min(0)
    .max(2 ** 32 - 1),
});
const eventSchema = z.object({
  event: z.string().min(1).max(80),
  time: z.iso.datetime(),
  lon: number(-180, 180),
  lat: number(-90, 90),
  depth: number(0, 700),
  mag: number(0, 10),
  place: z.string().max(200),
  catalog: z.string().min(1).max(80),
});

const round = (value: number, digits: number) => String(Number(value.toFixed(digits)));

export function encodeRunRequest(request: RunRequest): URLSearchParams {
  switch (request.kind) {
    case 'preset':
      return new URLSearchParams({ preset: request.id });
    case 'replay':
      return new URLSearchParams({ replay: request.event.id });
    case 'custom': {
      const { draft } = request;
      return new URLSearchParams({
        fault: draft.faultId,
        mw: round(draft.mw, 1),
        hypo: round(draft.hypocenterKm, 1),
        depth: round(draft.depthKm, 1),
        seed: String(draft.seed),
      });
    }
    case 'event': {
      const { event } = request;
      return new URLSearchParams({
        event: event.id,
        time: new Date(event.originMs).toISOString(),
        lon: round(event.lon, 4),
        lat: round(event.lat, 4),
        depth: round(event.depthKm, 1),
        mag: round(event.magnitude, 1),
        place: event.place,
        catalog: event.catalog,
      });
    }
  }
}

/** The request in a query string: null when it holds none, 'invalid' when it cannot be used. */
export function decodeRunRequest(search: string): RunRequest | 'invalid' | null {
  const params = Object.fromEntries(new URLSearchParams(search));
  if ('preset' in params) {
    const parsed = presetSchema.safeParse(params);
    return parsed.success ? { kind: 'preset', id: parsed.data.preset } : 'invalid';
  }
  if ('replay' in params) {
    const parsed = replaySchema.safeParse(params);
    const event = HISTORICAL_EVENTS.find((candidate) => candidate.id === parsed.data?.replay);
    return event ? { kind: 'replay', event } : 'invalid';
  }
  if ('fault' in params) {
    const parsed = customSchema.safeParse(params);
    if (!parsed.success) return 'invalid';
    const { fault, mw, hypo, depth, seed } = parsed.data;
    return {
      kind: 'custom',
      draft: { faultId: fault, mw, hypocenterKm: hypo, depthKm: depth, seed },
    };
  }
  if ('event' in params) {
    const parsed = eventSchema.safeParse(params);
    if (!parsed.success) return 'invalid';
    const { event, time, lon, lat, depth, mag, place, catalog } = parsed.data;
    return {
      kind: 'event',
      event: {
        id: event,
        originMs: Date.parse(time),
        lon,
        lat,
        depthKm: depth,
        magnitude: mag,
        place,
        catalog,
      },
    };
  }
  return null;
}
