// @vitest-environment jsdom
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { channelSensitivities } from '@/lib/formats/station-xml';

// jsdom replaces import.meta.url with an http URL, so the fixture is resolved from the root.
const fixture = resolve('tests/fixtures/feeds/ko-slvt-station.xml');

describe('StationXML channel sensitivities', () => {
  it('reads the KOERI SLVT accelerometer channels', async () => {
    const channels = channelSensitivities(await readFile(fixture, 'utf8'));
    expect(channels.map((c) => c.id).sort()).toEqual([
      'KO.SLVT..HNE',
      'KO.SLVT..HNN',
      'KO.SLVT..HNZ',
    ]);
    const east = channels.find((c) => c.id === 'KO.SLVT..HNE');
    expect(east).toMatchObject({
      lon: 28.2098,
      lat: 41.2288,
      sampleRateHz: 100,
      sensitivity: 317197.3389,
      inputUnits: 'm/s**2',
      endMs: Number.POSITIVE_INFINITY,
    });
    expect(east?.startMs).toBe(Date.UTC(2016, 3, 28));
  });

  it('rejects malformed XML', () => {
    expect(() => channelSensitivities('<FDSNStationXML><Network>')).toThrow(SyntaxError);
  });
});
