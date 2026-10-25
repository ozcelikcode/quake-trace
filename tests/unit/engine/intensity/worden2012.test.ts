import { describe, expect, it } from 'vitest';

import { combinedMmi, mmiFromPga, mmiFromPgv } from '@/engine/intensity/worden2012';

describe('Worden et al. (2012) intensity conversion', () => {
  it('uses the high-amplitude PGA segment above log10(PGA) = 1.57 cm/s²', () => {
    // 0.1 g = 98.1 cm/s²
    expect(mmiFromPga(0.1)).toBeCloseTo(-1.6 + 3.7 * Math.log10(98.1), 10);
  });

  it('uses the central PGA segment between the thresholds', () => {
    expect(mmiFromPga(0.01)).toBeCloseTo(1.78 + 1.55 * Math.log10(9.81), 10);
  });

  it('uses the ShakeMap low-amplitude extension', () => {
    expect(mmiFromPga(0.001)).toBeCloseTo(1.71 + 2.08 * Math.log10(0.981), 10);
    expect(mmiFromPgv(0.03)).toBeCloseTo(4.62 + 2.17 * Math.log10(0.03), 10);
  });

  it('converts PGV on both main segments', () => {
    expect(mmiFromPgv(10)).toBeCloseTo(2.89 + 3.16, 10);
    expect(mmiFromPgv(1)).toBeCloseTo(3.78, 10);
  });

  it('clamps to intensities I–X', () => {
    expect(mmiFromPga(5)).toBe(10);
    expect(mmiFromPga(1e-6)).toBe(1);
  });

  it('blends PGA- and PGV-based intensities between V and VII', () => {
    expect(combinedMmi(0.01, 100)).toBe(mmiFromPga(0.01));
    expect(combinedMmi(0.5, 20)).toBe(mmiFromPgv(20));
    const pga = 0.1; // about VI
    const weight = (mmiFromPga(pga) - 5) / 2;
    expect(combinedMmi(pga, 10)).toBeCloseTo(
      (1 - weight) * mmiFromPga(pga) + weight * mmiFromPgv(10),
      10,
    );
  });
});
