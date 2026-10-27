import { describe, expect, it } from 'vitest';

import { asb14LnMedian } from '@/engine/gmpe/asb14';
import { EDGE_MMI, eventGrid, shakingRadiusKm } from '@/engine/grid/event-grid';
import { combinedMmi } from '@/engine/intensity/worden2012';
import { haversineKm } from '@/lib/math/geo';

const mmiOnStiffSoil = (mw: number, rjbKm: number) => {
  const motion = { mw, rjbKm, vs30: 360, rakeDeg: 180 };
  return combinedMmi(
    Math.exp(asb14LnMedian('PGA', motion)),
    Math.exp(asb14LnMedian('PGV', motion)),
  );
};

describe('shakingRadiusKm', () => {
  it('is where the median stiff-soil intensity falls to the edge level', () => {
    for (const mw of [5, 6, 7, 7.4]) {
      const radius = shakingRadiusKm(mw, 180);
      expect(mmiOnStiffSoil(mw, radius * 0.98)).toBeGreaterThanOrEqual(EDGE_MMI - 1e-6);
      expect(mmiOnStiffSoil(mw, radius * 1.02)).toBeLessThan(EDGE_MMI);
    }
  });

  it('grows with magnitude', () => {
    expect(shakingRadiusKm(7.5, 180)).toBeGreaterThan(shakingRadiusKm(6, 180));
  });
});

describe('eventGrid', () => {
  const trace: [number, number][] = [
    [27.75, 40.85],
    [29.15, 40.9],
  ];

  it('keeps every edge at least the radius from the rupture', () => {
    const radius = 300;
    const grid = eventGrid(trace, radius, 120_000);
    const east = grid.west + grid.nx * grid.dLon;
    const south = grid.north - grid.ny * grid.dLat;
    expect(haversineKm(29.15, 40.9, east, 40.9)).toBeGreaterThanOrEqual(radius);
    expect(haversineKm(27.75, 40.85, grid.west, 40.85)).toBeGreaterThanOrEqual(radius);
    expect(haversineKm(28, 40.85, 28, south)).toBeGreaterThanOrEqual(radius - 1);
    expect(haversineKm(28, 40.9, 28, grid.north)).toBeGreaterThanOrEqual(radius - 1);
  });

  it('stays within the cell budget with roughly square cells', () => {
    const grid = eventGrid(trace, 600, 120_000);
    expect(grid.nx * grid.ny).toBeLessThanOrEqual(122_000);
    const cellWidthKm = haversineKm(28, 40.9, 28 + grid.dLon, 40.9);
    const cellHeightKm = haversineKm(28, 40.9, 28, 40.9 + grid.dLat);
    expect(cellWidthKm / cellHeightKm).toBeCloseTo(1, 1);
  });

  it('never goes below about 1 km cells for small events', () => {
    const grid = eventGrid(trace, 40, 120_000);
    expect(haversineKm(28, 40.9, 28, 40.9 + grid.dLat)).toBeGreaterThan(0.99);
  });
});
