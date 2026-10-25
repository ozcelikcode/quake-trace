/** Simulation clock as mm:ss.s (seconds after origin). */
export function formatClock(seconds: number): string {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const rest = safe - minutes * 60;
  return `${String(minutes).padStart(2, '0')}:${rest.toFixed(1).padStart(4, '0')}`;
}

const formatters = new Map<string, Intl.NumberFormat>();

/** Locale-aware number with a fixed number of fraction digits (cached per locale and digits). */
export function formatNumber(value: number, locale: string, fractionDigits = 0): string {
  const key = `${locale}:${String(fractionDigits)}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
    formatters.set(key, formatter);
  }
  return formatter.format(value);
}
