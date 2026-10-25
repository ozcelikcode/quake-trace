/**
 * Exponential window applied to white noise in the stochastic method, after Saragoni and Hart
 * (1974), in the form used by SMSIM (Boore, 2002, "SMSIM — Fortran programs for simulating
 * ground motions from earthquakes: version 2.0", USGS OFR 00-509, eq. 10):
 *
 *   w(t) = a·(t/tη)^b·exp(−c·t/tη)
 *
 * with a, b, c chosen so that w peaks at 1 when t = ε·tη and w(tη) = η. Boore recommends
 * ε = 0.2, η = 0.05 and tη = 2 × (source + path duration), with the window evaluated up to tη.
 */

export const WINDOW_EPSILON = 0.2;
export const WINDOW_ETA = 0.05;
/** SMSIM `f_tb2te`: converts the box duration into the exponential window's tη. */
export const WINDOW_DURATION_FACTOR = 2;

export interface ExponentialWindow {
  a: number;
  b: number;
  c: number;
}

/**
 * Peak at ε: dw/dx = 0 gives c = b/ε; w(ε) = 1 gives a = (e/ε)^b; w(1) = η then gives
 * b = −ε·ln η / (1 + ε·(ln ε − 1)).
 */
export function exponentialWindow(epsilon = WINDOW_EPSILON, eta = WINDOW_ETA): ExponentialWindow {
  const b = (-epsilon * Math.log(eta)) / (1 + epsilon * (Math.log(epsilon) - 1));
  return { a: (Math.E / epsilon) ** b, b, c: b / epsilon };
}

/** Window value at x = t/tη. */
export function windowValue(window: ExponentialWindow, x: number): number {
  if (x <= 0) return 0;
  return window.a * x ** window.b * Math.exp(-window.c * x);
}
