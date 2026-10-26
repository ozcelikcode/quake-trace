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

const compactFormatters = new Map<string, Intl.NumberFormat>();

/** Short locale-aware number for scale ticks: 10 B in Turkish, 10K in English. */
export function formatCompact(value: number, locale: string): string {
  let formatter = compactFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { notation: 'compact' });
    compactFormatters.set(locale, formatter);
  }
  return formatter.format(value);
}

const percentFormatters = new Map<string, Intl.NumberFormat>();

/** Locale-aware percentage of a 0–1 share: %4,0 in Turkish, 4.0% in English. */
export function formatPercent(share: number, locale: string, fractionDigits = 0): string {
  const key = `${locale}:${String(fractionDigits)}`;
  let formatter = percentFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: 'percent',
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
    percentFormatters.set(key, formatter);
  }
  return formatter.format(share);
}
