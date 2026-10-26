import { describe, expect, it } from 'vitest';

import { sequenceState } from '@/features/aftershocks/lib/sequence-state';
import type { AftershockCatalog } from '@/types/aftershocks';

const catalog: AftershockCatalog = {
  durationS: 7200,
  minMagnitude: 3,
  count: 3,
  timeS: Float32Array.from([10, 100, 5000]),
  lon: new Float32Array(3),
  lat: new Float32Array(3),
  depthKm: new Float32Array(3),
  magnitude: Float32Array.from([4.1, 5.6, 6.2]),
  forecastStepS: 3600,
  forecastM5: Float32Array.from([0.9, 0.5, 0.3]),
  forecastM6: Float32Array.from([0.4, 0.2, 0.1]),
};

describe('aftershock sequence state', () => {
  it('counts the shocks so far and finds the largest', () => {
    expect(sequenceState(catalog, 5)).toMatchObject({ count: 0, largest: -1 });
    expect(sequenceState(catalog, 100)).toMatchObject({ count: 2, largest: 1 });
    expect(sequenceState(catalog, 9999)).toMatchObject({ count: 3, largest: 2 });
  });

  it('reads the forecast of the last whole hour, clamped to the table', () => {
    expect(sequenceState(catalog, 3599).forecastM5).toBeCloseTo(0.9, 6);
    expect(sequenceState(catalog, 3600).forecastM6).toBeCloseTo(0.2, 6);
    expect(sequenceState(catalog, 1e6).forecastM5).toBeCloseTo(0.3, 6);
  });
});
