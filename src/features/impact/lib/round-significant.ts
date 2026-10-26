/** Rounds to `digits` significant figures, so model estimates do not suggest false precision. */
export function roundSignificant(value: number, digits = 2): number {
  if (value === 0 || !Number.isFinite(value)) return value;
  const magnitude = 10 ** (Math.floor(Math.log10(Math.abs(value))) - digits + 1);
  return Math.round(value / magnitude) * magnitude;
}
