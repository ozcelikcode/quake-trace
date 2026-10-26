import { describe, expect, it } from 'vitest';

import { okadaUz } from '@/engine/tsunami/okada';

/**
 * Okada (1985), Table 2, "Checklist for numerical calculations", uz of the finite rectangular
 * source; values as transcribed in F. Beauducel's okada85_checklist.m (IPGP deformation-lib,
 * commit c45a5af). Okada rounds to four significant figures.
 */
const close = (actual: number, expected: number) => {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(Math.abs(expected) * 5e-4 + 1e-12);
};

describe('Okada (1985) vertical displacement', () => {
  it('reproduces case 2 (x 2, y 3, d 4, δ 70°, L 3, W 2)', () => {
    close(okadaUz(2, 3, 4, 70, 3, 2, 1, 0), -2.747e-3);
    close(okadaUz(2, 3, 4, 70, 3, 2, 0, 1), -3.564e-2);
  });

  it('reproduces case 3 (x 0, y 0, d 4, δ 90°): no vertical motion', () => {
    expect(Math.abs(okadaUz(0, 0, 4, 90, 3, 2, 1, 0))).toBeLessThan(1e-12);
    expect(Math.abs(okadaUz(0, 0, 4, 90, 3, 2, 0, 1))).toBeLessThan(1e-12);
  });

  it('is linear in slip and antisymmetric for a vertical strike-slip fault', () => {
    expect(okadaUz(1, 2, 5, 60, 4, 3, 2, 0)).toBeCloseTo(2 * okadaUz(1, 2, 5, 60, 4, 3, 1, 0), 12);
    // Across the fault and about its midpoint the vertical motion changes sign.
    const a = okadaUz(1, 1, 5, 90, 4, 3, 1, 0);
    const b = okadaUz(3, -1, 5, 90, 4, 3, 1, 0);
    expect(a).not.toBe(0);
    expect(b).toBeCloseTo(a, 10);
    expect(okadaUz(1, -1, 5, 90, 4, 3, 1, 0)).toBeCloseTo(-a, 10);
  });

  it('uplifts the hanging wall of a shallow thrust and decays far away', () => {
    // Fault 20 km × 10 km, lower edge at 12 km, rising towards +y at 30°: its upper edge lies at
    // y = W·cos δ ≈ 8.7 km, 7 km deep. The hanging wall above the upper edge rises, the foot wall
    // beyond the lower edge sinks.
    expect(okadaUz(10, 10, 12, 30, 20, 10, 0, 1)).toBeGreaterThan(0.1);
    expect(okadaUz(10, -5, 12, 30, 20, 10, 0, 1)).toBeLessThan(0);
    expect(Math.abs(okadaUz(10, 300, 12, 30, 20, 10, 0, 1))).toBeLessThan(1e-3);
  });
});
