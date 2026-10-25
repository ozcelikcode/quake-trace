/**
 * Min/max envelope of a record in fixed time bins, so a trace can be drawn at any width without
 * touching every sample, plus the running peak |a| for "peak so far" readouts.
 */
/** 50 ms bins: about one bin per device pixel for a 2-minute scenario in a 380 px panel. */
export const ENVELOPE_BIN_S = 0.05;

export interface Envelope {
  binS: number;
  min: Float32Array;
  max: Float32Array;
  /** Largest |a| from the start of the record to the end of each bin. */
  runningPeak: Float32Array;
}

export function buildEnvelope(
  samples: ArrayLike<number>,
  sampleRateHz: number,
  binS: number,
): Envelope {
  const perBin = Math.max(1, Math.round(binS * sampleRateHz));
  const bins = Math.ceil(samples.length / perBin);
  const min = new Float32Array(bins);
  const max = new Float32Array(bins);
  const runningPeak = new Float32Array(bins);
  let peak = 0;
  for (let bin = 0; bin < bins; bin++) {
    let low = Number.POSITIVE_INFINITY;
    let high = Number.NEGATIVE_INFINITY;
    const end = Math.min(samples.length, (bin + 1) * perBin);
    for (let i = bin * perBin; i < end; i++) {
      const value = samples[i] ?? 0;
      if (value < low) low = value;
      if (value > high) high = value;
    }
    min[bin] = low;
    max[bin] = high;
    peak = Math.max(peak, Math.abs(low), Math.abs(high));
    runningPeak[bin] = peak;
  }
  return { binS: perBin / sampleRateHz, min, max, runningPeak };
}

/** Index of the bin containing `timeS`, clamped to the record; -1 before it starts. */
export function binAt(envelope: Envelope, timeS: number): number {
  if (timeS < 0) return -1;
  return Math.min(envelope.min.length - 1, Math.floor(timeS / envelope.binS));
}

/** Largest |a| recorded up to `timeS`. */
export function peakUntil(envelope: Envelope, timeS: number): number {
  const bin = binAt(envelope, timeS);
  return bin < 0 ? 0 : (envelope.runningPeak[bin] ?? 0);
}

/** Largest |a| over the whole record. */
export function recordPeak(envelope: Envelope): number {
  return envelope.runningPeak[envelope.runningPeak.length - 1] ?? 0;
}
