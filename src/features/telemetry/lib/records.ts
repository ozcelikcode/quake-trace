import type { RecordComponent, StationRecords } from '@/types/simulation';
import { RECORD_COMPONENTS } from '@/types/simulation';

/** One component of one station's record, viewed without copying. */
export function componentSamples(
  records: StationRecords,
  station: number,
  component: RecordComponent,
): Float32Array {
  const offset =
    (station * RECORD_COMPONENTS.length + RECORD_COMPONENTS.indexOf(component)) * records.samples;
  return records.accelCmS2.subarray(offset, offset + records.samples);
}

/**
 * Station indices in trigger order (untriggered stations last, by P arrival), so the list reads
 * as a record section and the triggered stations at any time form a prefix.
 */
export function triggerOrder(records: StationRecords): number[] {
  const key = (index: number) => {
    const station = records.stations[index];
    return station?.triggerS ?? Number.POSITIVE_INFINITY;
  };
  const arrival = (index: number) => records.stations[index]?.pArrivalS ?? 0;
  return records.stations
    .map((_, index) => index)
    .sort((a, b) => key(a) - key(b) || arrival(a) - arrival(b));
}

/** Number of stations in `order` that have triggered by `timeS`. */
export function triggeredCount(records: StationRecords, order: number[], timeS: number): number {
  let count = 0;
  while (count < order.length) {
    const triggerS = records.stations[order[count] ?? -1]?.triggerS;
    if (triggerS === undefined || triggerS === null || triggerS > timeS) break;
    count++;
  }
  return count;
}
