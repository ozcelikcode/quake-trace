import { describe, expect, it } from 'vitest';

import {
  accelerationSpectrum,
  cornerFrequencyHz,
  crustalAmplification,
  excitationDurationS,
  geometricSpreading,
  seismicMomentDyneCm,
} from '@/engine/synth/point-source';

describe('stochastic point-source spectrum (Boore 2003; Campbell 2003 WNA parameters)', () => {
  it('converts magnitude to moment with Hanks and Kanamori (1979)', () => {
    const m0 = seismicMomentDyneCm(6);
    expect((2 / 3) * Math.log10(m0) - 10.7).toBeCloseTo(6, 12);
  });

  it('gives the Brune corner frequency for Δσ = 100 bar, β = 3.5 km/s', () => {
    // 4.9e6 · 3.5 · (100 / 10^26.55)^(1/3) = 0.1124 Hz for Mw 7.
    expect(cornerFrequencyHz(7, 'S')).toBeCloseTo(0.1124, 4);
    // Constant stress drop: f0 ∝ M0^(-1/3), a factor 10^-0.5 per magnitude unit.
    expect(cornerFrequencyHz(7, 'S') / cornerFrequencyHz(6, 'S')).toBeCloseTo(10 ** -0.5, 10);
    // Madariaga (1976): k_P / k_S = 0.32 / 0.21.
    expect(cornerFrequencyHz(7, 'P') / cornerFrequencyHz(7, 'S')).toBeCloseTo(0.32 / 0.21, 12);
  });

  it('adds source duration 1/f0 and path duration 0.05 s/km', () => {
    expect(excitationDurationS(7, 100, 'S')).toBeCloseTo(1 / cornerFrequencyHz(7, 'S') + 5, 10);
  });

  it('spreads as 1/R to 40 km and as R^-0.5 beyond', () => {
    expect(geometricSpreading(10)).toBeCloseTo(0.1, 12);
    expect(geometricSpreading(40)).toBeCloseTo(0.025, 12);
    expect(geometricSpreading(160)).toBeCloseTo(0.0125, 12);
  });

  it('interpolates the crustal amplification in ln f and holds it beyond the table', () => {
    expect(crustalAmplification(0.51)).toBeCloseTo(1.42, 10);
    expect(crustalAmplification(Math.sqrt(0.51 * 0.84))).toBeCloseTo(1.5, 10);
    expect(crustalAmplification(0.001)).toBe(1);
    expect(crustalAmplification(500)).toBe(4.4);
  });

  it('rises as f² below the corner and is cut by kappa at high frequency', () => {
    const spectrum = accelerationSpectrum('S', 7, 1);
    expect(spectrum(0.002) / spectrum(0.001)).toBeCloseTo(4, 2);
    expect(spectrum(30) / spectrum(15)).toBeLessThan(0.5);
    expect(spectrum(0)).toBe(0);
  });

  it('scales P against S by the radiation coefficients and (β/α)³', () => {
    // Far below both corners the source terms are 1, and P shares the S path and site terms:
    // P / S(one horizontal) = (0.52 / 0.63) · (1/√3)³ / (1/√2).
    const ratio = accelerationSpectrum('P', 7, 1)(0.001) / accelerationSpectrum('S', 7, 1)(0.001);
    expect(ratio).toBeCloseTo((0.52 / 0.63) * 3 ** -1.5 * Math.SQRT2, 4);
  });
});
