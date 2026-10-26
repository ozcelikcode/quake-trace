import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { feedUrl, fetchFeed } from '@/data/feeds/client';

const fixture = (name: string) =>
  fileURLToPath(new URL(`../../../fixtures/feeds/${name}`, import.meta.url));
const NOW = Date.UTC(2026, 9, 26, 12);

describe('live catalog requests', () => {
  it('calls USGS and EMSC directly and AFAD and Kandilli through the proxy', () => {
    expect(feedUrl('usgs', NOW)).toMatch(
      /^https:\/\/earthquake\.usgs\.gov\/.*starttime=2026-10-19T12:00:00&minlatitude=39\.8/,
    );
    expect(feedUrl('emsc', NOW)).toMatch(
      /^https:\/\/www\.seismicportal\.eu\/.*minlon=26&maxlon=31/,
    );
    expect(feedUrl('afad', NOW)).toMatch(
      /^\/api\/afad\/event\/filter\?start=2026-10-19T12:00:00&end=2026-10-27T12:00:00/,
    );
    expect(feedUrl('kandilli', NOW)).toBe('/api/kandilli/lst0.asp');
  });

  it('decodes Kandilli and keeps the region and the last week', async () => {
    const bytes = await readFile(fixture('kandilli-lst0.html'));
    const events = await fetchFeed('kandilli', NOW, () => Promise.resolve(new Response(bytes)));
    expect(events.length).toBeGreaterThan(0);
    for (const event of events) {
      expect(event.lon).toBeGreaterThanOrEqual(26);
      expect(event.lat).toBeLessThanOrEqual(41.8);
      expect(event.timeMs).toBeGreaterThanOrEqual(NOW - 7 * 86_400_000);
    }
  });

  it('reports upstream failures', async () => {
    await expect(
      fetchFeed('afad', NOW, () => Promise.resolve(new Response('', { status: 502 }))),
    ).rejects.toThrow('HTTP 502');
  });
});
