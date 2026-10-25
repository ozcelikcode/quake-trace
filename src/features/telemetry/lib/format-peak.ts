import { formatNumber } from '@/lib/format';

/** Accelerations below 10 cm/s² keep one decimal so the noise floor and weak motion stay legible. */
export function formatPeak(valueCmS2: number, locale: string): string {
  return formatNumber(valueCmS2, locale, valueCmS2 < 10 ? 1 : 0);
}
