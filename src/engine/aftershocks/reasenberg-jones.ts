/**
 * Aftershock rate of Reasenberg and Jones (1989, Science 243, 1173–1176, eq. 4): the rate of
 * aftershocks of magnitude M or larger at time t (days) after a mainshock of magnitude Mm is
 *
 *   λ(t, M) = 10^(a + b·(Mm − M)) · (t + c)^(−p),
 *
 * a modified Omori law (Utsu, 1961) with Gutenberg–Richter magnitudes. Parameters: the generic
 * California sequence a = −1.67, b = 0.91, p = 1.08, c = 0.05 day, as quoted by the USGS
 * (Open-File Report 96-266). The sequence includes secondary aftershocks, so it is sampled as one
 * Poisson process rather than as a branching (ETAS) cascade.
 */

export interface SequenceParameters {
  a: number;
  b: number;
  p: number;
  /** Days. */
  c: number;
}

export const GENERIC_CALIFORNIA: SequenceParameters = { a: -1.67, b: 0.91, p: 1.08, c: 0.05 };

export const SECONDS_PER_DAY = 86_400;

/** ∫ (t + c)^(−p) dt from t1 to t2 (days). */
function omoriIntegral(t1: number, t2: number, { p, c }: SequenceParameters): number {
  if (Math.abs(p - 1) < 1e-9) return Math.log((t2 + c) / (t1 + c));
  return ((t2 + c) ** (1 - p) - (t1 + c) ** (1 - p)) / (1 - p);
}

/** Expected number of aftershocks of magnitude ≥ `magnitude` between t1 and t2 (days). */
export function expectedCount(
  mainshock: number,
  magnitude: number,
  t1Days: number,
  t2Days: number,
  parameters: SequenceParameters = GENERIC_CALIFORNIA,
): number {
  const { a, b } = parameters;
  return 10 ** (a + b * (mainshock - magnitude)) * omoriIntegral(t1Days, t2Days, parameters);
}

/** Probability of at least one aftershock ≥ `magnitude` in [t1, t2], from the Poisson count. */
export function exceedanceProbability(
  mainshock: number,
  magnitude: number,
  t1Days: number,
  t2Days: number,
  parameters: SequenceParameters = GENERIC_CALIFORNIA,
): number {
  return 1 - Math.exp(-expectedCount(mainshock, magnitude, t1Days, t2Days, parameters));
}

/** Time (days) of an aftershock in [0, T] from a uniform deviate, by inverting the Omori CDF. */
export function sampleTimeDays(
  uniform: number,
  durationDays: number,
  { p, c }: SequenceParameters = GENERIC_CALIFORNIA,
): number {
  if (Math.abs(p - 1) < 1e-9) return c * ((durationDays + c) / c) ** uniform - c;
  const start = c ** (1 - p);
  const end = (durationDays + c) ** (1 - p);
  return (start + uniform * (end - start)) ** (1 / (1 - p)) - c;
}

/**
 * Magnitude from a uniform deviate: Gutenberg–Richter with slope b, truncated to
 * [minimum, maximum] (aftershocks are kept below the mainshock).
 */
export function sampleMagnitude(
  uniform: number,
  minimum: number,
  maximum: number,
  b: number = GENERIC_CALIFORNIA.b,
): number {
  const tail = 1 - 10 ** (-b * (maximum - minimum));
  return minimum - Math.log10(1 - uniform * tail) / b;
}
