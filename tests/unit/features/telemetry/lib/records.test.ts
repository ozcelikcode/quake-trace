import { describe, expect, it } from 'vitest';

import { componentSamples, triggeredCount, triggerOrder } from '@/features/telemetry/lib/records';
import { resolveFocusedStation } from '@/state/telemetry-store';
import type { StationRecord, StationRecords } from '@/types/simulation';

const station = (id: string, triggerS: number | null, pArrivalS: number): StationRecord => ({
  id,
  lon: 0,
  lat: 0,
  epicentralKm: 0,
  rjbKm: 0,
  vs30: 400,
  pArrivalS,
  sArrivalS: pArrivalS * 1.7,
  pgaCmS2: 1,
  triggerS,
});

const records: StationRecords = {
  sampleRateHz: 1,
  samples: 2,
  // Station-major, then Z, N, E.
  accelCmS2: Float32Array.from([0, 1, 2, 3, 4, 5, 10, 11, 12, 13, 14, 15, 20, 21, 22, 23, 24, 25]),
  stations: [station('A', 5, 4.9), station('B', null, 9), station('C', 2, 1.9)],
};

describe('station records', () => {
  it('views one component without copying', () => {
    expect([...componentSamples(records, 1, 'N')]).toEqual([12, 13]);
    expect(componentSamples(records, 2, 'E').buffer).toBe(records.accelCmS2.buffer);
  });

  it('orders stations by trigger, untriggered last, and counts the triggered prefix', () => {
    const order = triggerOrder(records);
    expect(order).toEqual([2, 0, 1]);
    expect(triggeredCount(records, order, 1)).toBe(0);
    expect(triggeredCount(records, order, 3)).toBe(1);
    expect(triggeredCount(records, order, 100)).toBe(2);
  });

  it('focuses the chosen station, or the first to trigger', () => {
    expect(resolveFocusedStation(records, 'B')).toBe(1);
    expect(resolveFocusedStation(records, null)).toBe(2);
    expect(resolveFocusedStation(records, 'missing')).toBe(2);
  });
});
