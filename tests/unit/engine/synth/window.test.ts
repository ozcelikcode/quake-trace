import { describe, expect, it } from 'vitest';

import { exponentialWindow, WINDOW_EPSILON, WINDOW_ETA, windowValue } from '@/engine/synth/window';

describe('Saragoni–Hart exponential window (SMSIM form)', () => {
  const window = exponentialWindow();

  it('peaks at 1 when t = ε·tη and falls to η at tη (Boore, 2002, eq. 10)', () => {
    expect(windowValue(window, WINDOW_EPSILON)).toBeCloseTo(1, 12);
    expect(windowValue(window, 1)).toBeCloseTo(WINDOW_ETA, 12);
    const h = 1e-6;
    const slope =
      (windowValue(window, WINDOW_EPSILON + h) - windowValue(window, WINDOW_EPSILON - h)) / (2 * h);
    expect(slope).toBeCloseTo(0, 6);
  });

  it('starts at zero and has the analytic shape exponent for ε = 0.2, η = 0.05', () => {
    expect(windowValue(window, 0)).toBe(0);
    // b = −ε·ln η / (1 + ε·(ln ε − 1)) = 1.25315…
    expect(window.b).toBeCloseTo(1.25315, 5);
    expect(window.c).toBeCloseTo(window.b / WINDOW_EPSILON, 12);
  });
});
