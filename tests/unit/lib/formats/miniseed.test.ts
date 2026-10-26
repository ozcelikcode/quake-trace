import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { readMiniSeed, sampleRate } from '@/lib/formats/miniseed';

import reference from '../../../fixtures/feeds/ko-slvt-2025-04-23.obspy.json';

const fixture = fileURLToPath(
  new URL('../../../fixtures/feeds/ko-slvt-2025-04-23.mseed', import.meta.url),
);

describe('miniSEED 2.4 reader', () => {
  it('decodes the KOERI Steim2 records exactly as ObsPy does', async () => {
    const bytes = await readFile(fixture);
    const traces = readMiniSeed(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length),
    );
    expect(traces).toHaveLength(reference.traces.length);
    for (const expected of reference.traces) {
      const trace = traces.find(
        (t) => `${t.network}.${t.station}.${t.location}.${t.channel}` === expected.id,
      );
      expect(trace, expected.id).toBeDefined();
      if (!trace) continue;
      expect(trace.sampleRateHz).toBe(expected.rate);
      expect(trace.samples.length).toBe(expected.npts);
      expect(new Date(trace.startMs).toISOString()).toBe(expected.start.replace('000Z', 'Z'));
      expect([...trace.samples.subarray(0, 12)]).toEqual(expected.first);
      expect([...trace.samples.subarray(-5)]).toEqual(expected.last);
      expect(trace.samples.reduce((sum, value) => sum + value, 0)).toBe(expected.sum);
    }
  });

  it('reads SEED sample rate factors and multipliers', () => {
    expect(sampleRate(100, 1)).toBe(100);
    expect(sampleRate(1, -10)).toBeCloseTo(0.1, 12);
    expect(sampleRate(-10, 1)).toBeCloseTo(0.1, 12);
    expect(sampleRate(0, 1)).toBe(0);
  });
});
