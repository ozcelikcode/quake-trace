import { describe, expect, it } from 'vitest';

import { bearingDeg, destination, haversineKm, LocalProjection } from '@/lib/math/geo';

describe('spherical geometry', () => {
  it('measures one degree of latitude as about 111.2 km', () => {
    expect(haversineKm(29, 40, 29, 41)).toBeCloseTo(111.19, 1);
  });

  it('round-trips destination and bearing', () => {
    const [lon, lat] = destination(28.97, 41.01, 135, 50);
    expect(haversineKm(28.97, 41.01, lon, lat)).toBeCloseTo(50, 6);
    expect(bearingDeg(28.97, 41.01, lon, lat)).toBeCloseTo(135, 6);
  });

  it('projects locally in km', () => {
    const projection = new LocalProjection(29, 41);
    expect(projection.y(42)).toBeCloseTo(111.19, 1);
    expect(projection.x(30)).toBeCloseTo(111.19 * Math.cos((41 * Math.PI) / 180), 1);
  });
});
