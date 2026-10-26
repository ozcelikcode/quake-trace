import { describe, expect, it } from 'vitest';

import { cellAreaKm2, SETTLEMENT, settlementClasses, settlementOf } from '@/engine/grid/settlement';
import { EARTH_RADIUS_KM } from '@/lib/math/geo';

const RAD = Math.PI / 180;

describe('cell areas on the sphere', () => {
  it('sum to the area of the latitude band, R²·Δλ·(sin φ1 − sin φ2)', () => {
    const spec = { west: 26, north: 41.8, dLon: 0.01, dLat: 0.01, nx: 500, ny: 200 };
    let total = 0;
    for (let row = 0; row < spec.ny; row++) total += cellAreaKm2(spec, row) * spec.nx;
    const band = EARTH_RADIUS_KM ** 2 * 5 * RAD * (Math.sin(41.8 * RAD) - Math.sin(39.8 * RAD));
    expect(total).toBeCloseTo(band, 6);
  });

  it('is close to 0.93 km² for a 0.01° cell at 41° N', () => {
    const spec = { west: 0, north: 41.005, dLon: 0.01, dLat: 0.01, nx: 1, ny: 1 };
    expect(cellAreaKm2(spec, 0)).toBeCloseTo(1.112 * 0.8395, 2);
  });
});

describe('Degree of Urbanisation density classes (European Commission and Eurostat, 2021)', () => {
  it('uses 1,500 and 300 inhabitants per km²', () => {
    expect(settlementOf(1500)).toBe(SETTLEMENT.centre);
    expect(settlementOf(1499)).toBe(SETTLEMENT.cluster);
    expect(settlementOf(300)).toBe(SETTLEMENT.cluster);
    expect(settlementOf(299)).toBe(SETTLEMENT.rural);
  });

  it('classifies residents per cell by the cell area', () => {
    const spec = { west: 0, north: 0.005, dLon: 0.01, dLat: 0.01, nx: 3, ny: 1 };
    const area = cellAreaKm2(spec, 0);
    const classes = settlementClasses(spec, Float32Array.from([2000 * area, 500 * area, -1]));
    expect([...classes]).toEqual([SETTLEMENT.centre, SETTLEMENT.cluster, SETTLEMENT.rural]);
  });
});
