// @vitest-environment jsdom
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { fetchObservedRecords, observedUrls } from '@/data/feeds/waveforms';

// jsdom replaces import.meta.url with an http URL, so fixtures are resolved from the root.
const fixture = (name: string) => resolve('tests/fixtures/feeds', name);

/** USGS us7000pufs, 2025-04-23 09:49:11.631 UTC, Mw 6.2. */
const ORIGIN_MS = Date.UTC(2025, 3, 23, 9, 49, 11, 631);
const request = { stationIds: ['KO.SLVT'], originMs: ORIGIN_MS, durationS: 100, sampleRateHz: 100 };

describe('observed strong-motion records', () => {
  it('asks the KOERI node for the accelerometer channels around the origin', () => {
    const urls = observedUrls({ ...request, stationIds: ['KO.SLVT', 'KO.GEML'] });
    expect(urls.dataselect).toBe(
      '/api/koeri/dataselect/1/query?net=KO&sta=SLVT,GEML&cha=HN?&start=2025-04-23T09:49:01&end=2025-04-23T09:50:51',
    );
    expect(urls.station).toContain('level=channel');
  });

  it('converts the 2025 Silivri record of SLVT to cm/s² from the origin', async () => {
    const mseed = await readFile(fixture('ko-slvt-2025-04-23.mseed'));
    const xml = await readFile(fixture('ko-slvt-station.xml'), 'utf8');
    const [record] = await fetchObservedRecords(request, (url) =>
      Promise.resolve(new Response(url.includes('dataselect') ? mseed : xml)),
    );
    expect(record?.stationId).toBe('KO.SLVT');
    for (const component of ['Z', 'N', 'E'] as const) {
      const samples = record?.components[component];
      expect(samples).toHaveLength(100 * 100 + 1);
      // Quiet before the S wave reaches the station about 40 km away.
      const early = samples?.subarray(0, 300) ?? new Float32Array();
      expect(Math.max(...early.map(Math.abs))).toBeLessThan(2);
    }
    // HNE in ObsPy: extreme −105,120 counts on a baseline near −44,000, at 317,197 counts per
    // m/s², a peak of about 19 cm/s².
    const peak = Math.max(...(record?.components.E ?? new Float32Array()).map(Math.abs));
    expect(peak).toBeGreaterThan(17);
    expect(peak).toBeLessThan(21);
  });

  it('returns nothing when the node has no data (204)', async () => {
    const records = await fetchObservedRecords(request, () =>
      Promise.resolve(new Response(null, { status: 204 })),
    );
    expect(records).toEqual([]);
  });
});
