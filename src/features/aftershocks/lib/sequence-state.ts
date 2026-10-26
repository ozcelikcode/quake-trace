import type { AftershockCatalog } from '@/types/aftershocks';

export interface SequenceState {
  /** Aftershocks that have occurred by the clock. */
  count: number;
  /** Index of the largest of them, or -1. */
  largest: number;
  /** Probability of M ≥ 5 and M ≥ 6 in the next 24 h, at the last whole forecast step. */
  forecastM5: number;
  forecastM6: number;
}

/** The sequence as known at `timeS`: events are sorted by time, so they form a prefix. */
export function sequenceState(catalog: AftershockCatalog, timeS: number): SequenceState {
  let count = 0;
  while (count < catalog.count && (catalog.timeS[count] ?? Infinity) <= timeS) count++;
  let largest = -1;
  for (let i = 0; i < count; i++) {
    if ((catalog.magnitude[i] ?? 0) > (catalog.magnitude[largest] ?? Number.NEGATIVE_INFINITY)) {
      largest = i;
    }
  }
  const step = Math.min(
    catalog.forecastM5.length - 1,
    Math.max(0, Math.floor(timeS / catalog.forecastStepS)),
  );
  return {
    count,
    largest,
    forecastM5: catalog.forecastM5[step] ?? 0,
    forecastM6: catalog.forecastM6[step] ?? 0,
  };
}
