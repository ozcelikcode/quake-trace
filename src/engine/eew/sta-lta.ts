/**
 * Classic STA/LTA trigger (Trnkoczy, 2012, "Understanding and parameter setting of STA/LTA
 * trigger algorithm", NMSOP-2 IS 8.1): the mean absolute amplitude over a short trailing window
 * divided by that over a long trailing window. As in ObsPy's `classic_sta_lta`, both windows end
 * at the current sample and the ratio is 0 until the long window is full.
 *
 * Parameters from the same source: STA 0.5 s (0.3–0.5 s is common for local earthquakes), LTA
 * 60 s ("a common initial value") and a trigger threshold of 4 ("common for an average quiet
 * seismic site").
 */

export const STA_S = 0.5;
export const LTA_S = 60;
export const TRIGGER_RATIO = 4;

export function staLtaRatio(
  signal: ArrayLike<number>,
  staSamples: number,
  ltaSamples: number,
): Float64Array {
  if (staSamples < 1 || ltaSamples < staSamples) {
    throw new RangeError('STA/LTA windows must satisfy 1 ≤ STA ≤ LTA');
  }
  const ratio = new Float64Array(signal.length);
  let staSum = 0;
  let ltaSum = 0;
  for (let i = 0; i < signal.length; i++) {
    const amplitude = Math.abs(signal[i] ?? 0);
    staSum += amplitude;
    ltaSum += amplitude;
    if (i >= staSamples) staSum -= Math.abs(signal[i - staSamples] ?? 0);
    if (i >= ltaSamples) ltaSum -= Math.abs(signal[i - ltaSamples] ?? 0);
    if (i < ltaSamples - 1) continue;
    const lta = ltaSum / ltaSamples;
    ratio[i] = lta > 0 ? staSum / staSamples / lta : 0;
  }
  return ratio;
}

/** Index of the first sample at or above the threshold, or -1. */
export function firstTriggerIndex(ratio: ArrayLike<number>, threshold = TRIGGER_RATIO): number {
  for (let i = 0; i < ratio.length; i++) if ((ratio[i] ?? 0) >= threshold) return i;
  return -1;
}
