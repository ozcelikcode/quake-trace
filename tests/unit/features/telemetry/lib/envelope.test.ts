import { describe, expect, it } from 'vitest';

import { binAt, buildEnvelope, peakUntil, recordPeak } from '@/features/telemetry/lib/envelope';

describe('record envelope', () => {
  // 10 Hz, bins of 0.2 s = 2 samples.
  const samples = [0, 1, -3, 2, 0.5, -0.5, 4, -1];
  const envelope = buildEnvelope(samples, 10, 0.2);

  it('keeps min and max per bin', () => {
    expect([...envelope.min]).toEqual([0, -3, -0.5, -1]);
    expect([...envelope.max]).toEqual([1, 2, 0.5, 4]);
  });

  it('tracks the running peak |a| for peak-so-far readouts', () => {
    expect([...envelope.runningPeak]).toEqual([1, 3, 3, 4]);
    expect(peakUntil(envelope, -1)).toBe(0);
    expect(peakUntil(envelope, 0.45)).toBe(3);
    expect(peakUntil(envelope, 99)).toBe(4);
    expect(recordPeak(envelope)).toBe(4);
    expect(binAt(envelope, 0.25)).toBe(1);
  });
});
