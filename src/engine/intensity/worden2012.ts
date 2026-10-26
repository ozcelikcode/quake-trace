/**
 * Ground-motion to intensity conversion of Worden, Gerstenberger, Rhoades and Wald (2012),
 * Bull. Seismol. Soc. Am. 102(1):204–221, equation 3 (no magnitude or distance terms), with the
 * low-amplitude extension used by USGS ShakeMap (esi-shakelib `wgrw12.py`).
 *
 * MMI = C1 + C2·log10(Y) below T1, C3 + C4·log10(Y) above; Y in cm/s² for PGA, cm/s for PGV.
 */

interface Relation {
  c1: number;
  c2: number;
  c3: number;
  c4: number;
  t1: number;
  /** ShakeMap's low-amplitude segment, used below its own threshold. */
  low: { c1: number; c2: number; t1: number };
}

// prettier-ignore
const PGA_RELATION: Relation = {
  c1: 1.78, c2: 1.55, c3: -1.6, c4: 3.7, t1: 1.57,
  low: { c1: 1.71, c2: 2.08, t1: 0.14 },
};
// prettier-ignore
const PGV_RELATION: Relation = {
  c1: 3.78, c2: 1.47, c3: 2.89, c4: 3.16, t1: 0.53,
  low: { c1: 4.62, c2: 2.17, t1: -1.21 },
};

/** g in cm/s², rounded as in ShakeMap so intensities match its maps. */
export const G_CMS2 = 981;
const MMI_MIN = 1;
const MMI_MAX = 10;

function clampMmi(mmi: number): number {
  return Math.min(MMI_MAX, Math.max(MMI_MIN, mmi));
}

function convert(relation: Relation, log10Value: number): number {
  if (log10Value < relation.low.t1) return relation.low.c1 + relation.low.c2 * log10Value;
  if (log10Value < relation.t1) return relation.c1 + relation.c2 * log10Value;
  return relation.c3 + relation.c4 * log10Value;
}

export function mmiFromPga(pgaG: number): number {
  return clampMmi(convert(PGA_RELATION, Math.log10(pgaG * G_CMS2)));
}

export function mmiFromPgv(pgvCms: number): number {
  return clampMmi(convert(PGV_RELATION, Math.log10(pgvCms)));
}

/**
 * Single intensity from both measures, following the classic ShakeMap blending (Wald et al.,
 * 1999, Earthquake Spectra 15(3)): PGA governs up to intensity V, PGV from VII, with a linear
 * weight in between, since PGV correlates better with damage-level shaking.
 */
export function combinedMmi(pgaG: number, pgvCms: number): number {
  const fromPga = mmiFromPga(pgaG);
  const fromPgv = mmiFromPgv(pgvCms);
  if (fromPga <= 5) return fromPga;
  if (fromPga >= 7) return fromPgv;
  const weight = (fromPga - 5) / 2;
  return (1 - weight) * fromPga + weight * fromPgv;
}
