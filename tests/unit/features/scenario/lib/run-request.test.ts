import { describe, expect, it } from 'vitest';

import { HISTORICAL_EVENTS } from '@/features/replay/lib/historical-events';
import {
  decodeRunRequest,
  encodeRunRequest,
  type RunRequest,
} from '@/features/scenario/lib/run-request';

const roundTrip = (request: RunRequest) =>
  decodeRunRequest(`?${encodeRunRequest(request).toString()}`);

describe('share links', () => {
  it('round-trips a preset and a replay by id', () => {
    expect(roundTrip({ kind: 'preset', id: 'kumburgaz' })).toEqual({
      kind: 'preset',
      id: 'kumburgaz',
    });
    const event = HISTORICAL_EVENTS[0];
    expect(encodeRunRequest({ kind: 'replay', event }).toString()).toBe(`replay=${event.id}`);
    expect(roundTrip({ kind: 'replay', event })).toEqual({ kind: 'replay', event });
  });

  it('round-trips an editor draft as readable parameters', () => {
    const draft = { faultId: 'TRCF045', mw: 7.2, hypocenterKm: 120.25, depthKm: 9, seed: 42 };
    const params = encodeRunRequest({ kind: 'custom', draft });
    expect(params.toString()).toBe('fault=TRCF045&mw=7.2&hypo=120.3&depth=9&seed=42');
    expect(decodeRunRequest(params.toString())).toEqual({
      kind: 'custom',
      draft: { ...draft, hypocenterKm: 120.3 },
    });
  });

  it('round-trips a catalog event, including text that needs escaping', () => {
    const event = {
      id: 'emsc-123',
      originMs: Date.UTC(2026, 9, 20, 3, 4, 5, 600),
      lon: 28.12346,
      lat: 40.85,
      depthKm: 10.04,
      magnitude: 4.6,
      place: 'Marmara Denizi & Silivri (İstanbul)',
      catalog: 'AFAD, EMSC',
    };
    expect(roundTrip({ kind: 'event', event })).toEqual({
      kind: 'event',
      event: { ...event, lon: 28.1235, depthKm: 10 },
    });
  });

  it('returns null without a request and rejects unusable ones', () => {
    expect(decodeRunRequest('')).toBeNull();
    expect(decodeRunRequest('?utm_source=x')).toBeNull();
    expect(decodeRunRequest('?preset=nowhere')).toBe('invalid');
    expect(decodeRunRequest('?replay=replay-1912')).toBe('invalid');
    expect(decodeRunRequest('?fault=TRCF045&mw=12&hypo=1&depth=9&seed=1')).toBe('invalid');
    expect(decodeRunRequest('?fault=TRCF045&mw=7&hypo=1&depth=9&seed=1.5')).toBe('invalid');
    expect(decodeRunRequest('?fault=<script>&mw=7&hypo=1&depth=9&seed=1')).toBe('invalid');
    expect(
      decodeRunRequest('?event=x&time=yesterday&lon=0&lat=0&depth=1&mag=5&place=&catalog=y'),
    ).toBe('invalid');
  });
});
