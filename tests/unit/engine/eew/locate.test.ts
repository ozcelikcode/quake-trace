import { describe, expect, it } from 'vitest';

import { locateByGridSearch } from '@/engine/eew/locate';
import { IASP91_CRUST } from '@/engine/velocity/layered-model';
import { TravelTimeCurve } from '@/engine/velocity/travel-time';
import { haversineKm } from '@/lib/math/geo';

describe('grid-search location', () => {
  const curve = new TravelTimeCurve(IASP91_CRUST, 'P', 10, 300);
  const source = { lon: 28.62, lat: 40.81, originS: 1.5 };
  const stations = [
    [28.3, 41.05],
    [29.0, 41.0],
    [28.9, 40.6],
    [28.4, 40.55],
  ] as const;
  const picks = stations.map(([lon, lat]) => ({
    lon,
    lat,
    timeS: source.originS + curve.time(haversineKm(source.lon, source.lat, lon, lat)),
  }));

  it('recovers the epicentre and origin time of exact picks', () => {
    const location = locateByGridSearch(picks, curve, { stepDeg: 0.01, marginDeg: 0.3 });
    expect(haversineKm(location.lon, location.lat, source.lon, source.lat)).toBeLessThan(1.5);
    expect(location.originS).toBeCloseTo(source.originS, 1);
    expect(location.rmsS).toBeLessThan(0.05);
  });

  it('needs at least one pick', () => {
    expect(() => locateByGridSearch([], curve, { stepDeg: 0.1, marginDeg: 0.1 })).toThrow(
      RangeError,
    );
  });
});
