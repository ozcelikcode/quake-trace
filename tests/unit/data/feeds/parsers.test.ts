import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { inRegion, mergeReports } from '@/data/feeds/merge';
import { parseAfad, parseEmsc, parseKandilli, parseUsgs } from '@/data/feeds/parsers';

const fixture = (name: string) =>
  fileURLToPath(new URL(`../../../fixtures/feeds/${name}`, import.meta.url));
const json = async (name: string): Promise<unknown> =>
  JSON.parse(await readFile(fixture(name), 'utf8'));

describe('live catalog parsers', () => {
  it('reads USGS GeoJSON, including the historical replay events', async () => {
    const events = parseUsgs(await json('usgs-events.json'));
    const kocaeli = events.find((e) => e.sourceId === 'usp0009d4z');
    expect(kocaeli).toMatchObject({
      magnitude: 7.6,
      magnitudeType: 'mwc',
      lon: 29.864,
      lat: 40.748,
    });
    expect(new Date(kocaeli?.timeMs ?? 0).toISOString()).toBe('1999-08-17T00:01:39.130Z');
  });

  it('reads EMSC and AFAD and agrees on a shared event', async () => {
    const emsc = parseEmsc(await json('emsc-events.json'));
    const afad = parseAfad(await json('afad-events.json'));
    expect(afad).toHaveLength(22);
    const karacabey = afad.find((e) => e.place === 'Karacabey (Bursa)');
    expect(karacabey).toMatchObject({ lon: 28.3035, lat: 40.146, depthKm: 6.9, magnitude: 1.6 });
    // AFAD dates carry no zone but are UTC: the same event in EMSC is 0.28 s later.
    const twin = emsc.find((e) => e.lon === 28.3035 && e.lat === 40.146);
    expect(Math.abs((twin?.timeMs ?? 0) - (karacabey?.timeMs ?? 0))).toBeLessThan(1000);
  });

  it('reads the Kandilli list in Windows-1254 local time', async () => {
    const text = new TextDecoder('windows-1254').decode(
      await readFile(fixture('kandilli-lst0.html')),
    );
    const events = parseKandilli(text);
    expect(events).toHaveLength(500);
    const [latest] = events;
    // 2026.10.26 13:45:38 in Türkiye (UTC+3).
    expect(new Date(latest?.timeMs ?? 0).toISOString()).toBe('2026-10-26T10:45:38.000Z');
    expect(latest).toMatchObject({ lat: 37.8635, lon: 35.9367, magnitude: 2, magnitudeType: 'ML' });
    expect(latest?.place).toBe('KIZILYER-FEKE (ADANA)');
  });

  it('drops malformed AFAD entries by rejecting the response', () => {
    expect(() => parseAfad([{ eventID: '1', date: 'yesterday' }])).toThrow();
  });
});

describe('merging catalogs', () => {
  it('joins reports of one earthquake and prefers the national agency', async () => {
    const reports = [
      ...parseAfad(await json('afad-events.json')),
      ...parseEmsc(await json('emsc-events.json')),
    ];
    const events = mergeReports(reports);
    const karacabey = events.find((e) => e.place === 'Karacabey (Bursa)');
    expect(karacabey?.source).toBe('afad');
    expect(karacabey?.id).toBe('afad:597383');
    expect(karacabey?.reports.map((r) => r.source)).toEqual(['afad', 'emsc']);
    expect(events.length).toBeLessThan(reports.length);
    for (let i = 1; i < events.length; i++) {
      expect(events[i - 1]?.timeMs).toBeGreaterThanOrEqual(events[i]?.timeMs ?? 0);
    }
  });

  it('keeps reports apart beyond 30 s or 30 km and never merges two from one catalog', () => {
    const base = {
      source: 'emsc' as const,
      sourceId: 'a',
      timeMs: 0,
      lon: 29,
      lat: 40.8,
      depthKm: 10,
      magnitude: 3,
      magnitudeType: 'ML',
      place: '',
    };
    expect(mergeReports([base, { ...base, sourceId: 'b' }])).toHaveLength(2);
    expect(mergeReports([base, { ...base, source: 'usgs', timeMs: 31_000 }])).toHaveLength(2);
    expect(mergeReports([base, { ...base, source: 'usgs', lon: 29.5 }])).toHaveLength(2);
    expect(mergeReports([base, { ...base, source: 'usgs', timeMs: 20_000 }])).toHaveLength(1);
    expect(inRegion(base, { west: 26, east: 31, south: 39.8, north: 41.8 })).toBe(true);
  });
});
