import { describe, expect, it } from 'vitest';

import { coastReached, highestCoast } from '@/features/tsunami/lib/coast-reached';

const coast = [
  { index: 1, arrivalS: 300, maxEtaM: 0.4, lon: 0, lat: 0 },
  { index: 2, arrivalS: 60, maxEtaM: 1.2, lon: 0, lat: 0 },
  { index: 3, arrivalS: Number.POSITIVE_INFINITY, maxEtaM: 0, lon: 0, lat: 0 },
];

describe('coastal tsunami', () => {
  it('lists the districts reached by the clock in order of arrival', () => {
    expect(coastReached(coast, 30)).toEqual([]);
    expect(coastReached(coast, 400).map((entry) => entry.index)).toEqual([2, 1]);
    expect(coastReached(coast, Number.POSITIVE_INFINITY)).toHaveLength(3);
  });

  it('finds the highest coastal wave', () => {
    expect(highestCoast(coast)?.index).toBe(2);
    expect(highestCoast([])).toBeUndefined();
  });
});
