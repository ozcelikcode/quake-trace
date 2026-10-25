import { describe, expect, it } from 'vitest';

import { fft, ifft, isPowerOfTwo, nextPowerOfTwo } from '@/lib/math/fft';

/** Direct O(N²) evaluation of the DFT definition, the reference for the fast transform. */
function naiveDft(signal: number[]): { re: number[]; im: number[] } {
  const n = signal.length;
  const re: number[] = [];
  const im: number[] = [];
  for (let k = 0; k < n; k++) {
    let sumRe = 0;
    let sumIm = 0;
    signal.forEach((value, t) => {
      sumRe += value * Math.cos((2 * Math.PI * k * t) / n);
      sumIm -= value * Math.sin((2 * Math.PI * k * t) / n);
    });
    re.push(sumRe);
    im.push(sumIm);
  }
  return { re, im };
}

describe('fast Fourier transform', () => {
  const signal = Array.from({ length: 32 }, (_, i) => Math.sin(i * 0.7) + 0.3 * Math.cos(i * 2.1));

  it('matches the DFT definition', () => {
    const re = Float64Array.from(signal);
    const im = new Float64Array(signal.length);
    fft(re, im);
    const reference = naiveDft(signal);
    for (let k = 0; k < signal.length; k++) {
      expect(re[k]).toBeCloseTo(reference.re[k] ?? Number.NaN, 10);
      expect(im[k]).toBeCloseTo(reference.im[k] ?? Number.NaN, 10);
    }
  });

  it('puts a cosine of bin 3 at bins 3 and N−3 with amplitude N/2', () => {
    const n = 64;
    const re = Float64Array.from({ length: n }, (_, t) => Math.cos((2 * Math.PI * 3 * t) / n));
    const im = new Float64Array(n);
    fft(re, im);
    expect(re[3]).toBeCloseTo(n / 2, 10);
    expect(re[n - 3]).toBeCloseTo(n / 2, 10);
    expect(Math.hypot(re[5] ?? 0, im[5] ?? 0)).toBeLessThan(1e-9);
  });

  it('inverts exactly and conserves energy (Parseval)', () => {
    const re = Float64Array.from(signal);
    const im = new Float64Array(signal.length);
    fft(re, im);
    let spectral = 0;
    for (let k = 0; k < re.length; k++) spectral += (re[k] ?? 0) ** 2 + (im[k] ?? 0) ** 2;
    const temporal = signal.reduce((sum, value) => sum + value * value, 0);
    expect(spectral / re.length).toBeCloseTo(temporal, 9);
    ifft(re, im);
    signal.forEach((value, i) => {
      expect(re[i]).toBeCloseTo(value, 12);
      expect(im[i]).toBeCloseTo(0, 12);
    });
  });

  it('accepts only power-of-two lengths', () => {
    expect(() => {
      fft(new Float64Array(12), new Float64Array(12));
    }).toThrow(RangeError);
    expect(isPowerOfTwo(1024)).toBe(true);
    expect(isPowerOfTwo(1000)).toBe(false);
    expect(nextPowerOfTwo(1000)).toBe(1024);
    expect(nextPowerOfTwo(1024)).toBe(1024);
  });
});
