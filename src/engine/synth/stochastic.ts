import { fft, ifft, nextPowerOfTwo } from '@/lib/math/fft';

import type { Random } from '../random/random';
import { exponentialWindow, WINDOW_DURATION_FACTOR, windowValue } from './window';

const WINDOW = exponentialWindow();

/**
 * Realizations of the stochastic method (Boore, 2003, section 3): Gaussian white noise is shaped
 * by the exponential window over tη = 2 × duration, transformed to the frequency domain,
 * normalized to a mean-square amplitude spectrum of unity, multiplied by the target Fourier
 * amplitude spectrum and transformed back. Realizations share one evaluation of the spectrum.
 *
 * Each series is acceleration (in the spectrum's units per second, cm/s² for a cm/s spectrum)
 * starting at the window onset, zero-padded to at least twice the window so the spectral shaping
 * does not wrap the coda onto the onset.
 */
export function stochasticMotions(
  random: Random,
  spectrum: (frequencyHz: number) => number,
  durationS: number,
  sampleRateHz: number,
  count: number,
): Float64Array[] {
  const tEtaS = WINDOW_DURATION_FACTOR * durationS;
  const windowSamples = Math.max(1, Math.ceil(tEtaS * sampleRateHz));
  const n = nextPowerOfTwo(2 * windowSamples);
  const amplitudes = new Float64Array(n / 2 + 1);
  for (let k = 0; k <= n / 2; k++) amplitudes[k] = spectrum((k * sampleRateHz) / n);
  const window = new Float64Array(windowSamples);
  for (let i = 0; i < windowSamples; i++) {
    window[i] = windowValue(WINDOW, i / sampleRateHz / tEtaS);
  }

  const motions: Float64Array[] = [];
  for (let realization = 0; realization < count; realization++) {
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    for (let i = 0; i < windowSamples; i++) re[i] = random.normal() * (window[i] ?? 0);

    fft(re, im);
    let meanSquare = 0;
    for (let k = 0; k < n; k++) meanSquare += (re[k] ?? 0) ** 2 + (im[k] ?? 0) ** 2;
    meanSquare /= n;
    const normalization = meanSquare > 0 ? 1 / Math.sqrt(meanSquare) : 0;

    for (let k = 0; k < n; k++) {
      const gain = (amplitudes[k <= n / 2 ? k : n - k] ?? 0) * normalization;
      re[k] = (re[k] ?? 0) * gain;
      im[k] = (im[k] ?? 0) * gain;
    }
    ifft(re, im);

    // The continuous inverse transform carries 1/Δt relative to the discrete one.
    for (let i = 0; i < n; i++) re[i] = (re[i] ?? 0) * sampleRateHz;
    motions.push(re);
  }
  return motions;
}
