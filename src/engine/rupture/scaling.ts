/**
 * Rupture area–magnitude scaling of Wells and Coppersmith (1994), Bull. Seismol. Soc. Am. 84(4):
 * 974–1002, Table 2A, by slip type. Rake classes follow the convention used by OpenQuake
 * hazardlib (`WC1994`).
 */

export type RakeClass = 'strike-slip' | 'reverse' | 'normal';

export function rakeClass(rakeDeg: number): RakeClass {
  if ((rakeDeg >= -45 && rakeDeg <= 45) || rakeDeg >= 135 || rakeDeg <= -135) return 'strike-slip';
  return rakeDeg > 0 ? 'reverse' : 'normal';
}

/** log10(A) = a + b·M, A in km². */
const AREA_FROM_MAGNITUDE: Record<RakeClass, { a: number; b: number }> = {
  'strike-slip': { a: -3.42, b: 0.9 },
  reverse: { a: -3.99, b: 0.98 },
  normal: { a: -2.87, b: 0.82 },
};

/** M = a + b·log10(A), A in km². A separate regression, not the inverse of the one above. */
const MAGNITUDE_FROM_AREA: Record<RakeClass, { a: number; b: number }> = {
  'strike-slip': { a: 3.98, b: 1.02 },
  reverse: { a: 4.33, b: 0.9 },
  normal: { a: 3.93, b: 1.02 },
};

export function medianRuptureAreaKm2(mw: number, rakeDeg: number): number {
  const { a, b } = AREA_FROM_MAGNITUDE[rakeClass(rakeDeg)];
  return 10 ** (a + b * mw);
}

export function magnitudeFromRuptureArea(areaKm2: number, rakeDeg: number): number {
  const { a, b } = MAGNITUDE_FROM_AREA[rakeClass(rakeDeg)];
  return a + b * Math.log10(areaKm2);
}
