import { describe, expect, it } from 'vitest';

import { createRandom } from '@/engine/random/random';
import { accelerationSpectrum, excitationDurationS } from '@/engine/synth/point-source';
import { stochasticMotions } from '@/engine/synth/stochastic';
import { fft } from '@/lib/math/fft';

const RATE = 100;
const spectrum = accelerationSpectrum('S', 6, 20);
const duration = excitationDurationS(6, 20, 'S');

describe('stochastic method realizations', () => {
  const [motion, second] = stochasticMotions(createRandom(3), spectrum, duration, RATE, 2);
  if (!motion || !second) throw new Error('expected two realizations');

  it('reproduces the target Fourier amplitude spectrum, band by band', () => {
    const n = motion.length;
    const re = Float64Array.from(motion);
    const im = new Float64Array(n);
    fft(re, im);
    for (const [low, high] of [
      [1, 2],
      [2, 5],
      [5, 10],
      [10, 20],
    ] as const) {
      let simulated = 0;
      let target = 0;
      let bins = 0;
      for (let k = 1; k <= n / 2; k++) {
        const f = (k * RATE) / n;
        if (f < low || f >= high) continue;
        // Continuous Fourier amplitude = Δt × discrete amplitude.
        simulated += (Math.hypot(re[k] ?? 0, im[k] ?? 0) / RATE) ** 2;
        target += spectrum(f) ** 2;
        bins++;
      }
      expect(bins).toBeGreaterThanOrEqual(20);
      expect(Math.sqrt(simulated / target)).toBeGreaterThan(0.75);
      expect(Math.sqrt(simulated / target)).toBeLessThan(1.25);
    }
  });

  it('has no mean and keeps its energy inside the window', () => {
    const windowSamples = Math.ceil(2 * duration * RATE);
    let total = 0;
    let inside = 0;
    let sum = 0;
    motion.forEach((value, i) => {
      total += value * value;
      sum += value;
      if (i < windowSamples * 1.1) inside += value * value;
    });
    expect(inside / total).toBeGreaterThan(0.95);
    expect(Math.abs(sum / motion.length)).toBeLessThan(1e-6 * Math.sqrt(total / motion.length));
  });

  it('is deterministic per seed, with independent realizations', () => {
    const [again] = stochasticMotions(createRandom(3), spectrum, duration, RATE, 1);
    expect(again).toEqual(motion);
    expect(second).not.toEqual(motion);
  });
});
