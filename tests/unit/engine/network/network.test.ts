import { describe, expect, it } from 'vitest';

import { DEMAND_DECAY_S } from '@/engine/network/call-demand';
import { cellNetwork } from '@/engine/network/network';
import { cellAreaKm2 } from '@/engine/grid/settlement';
import { serviceAreas } from '@/engine/network/service-areas';

// Three cells in a row; the middle one has no site.
const spec = { west: 0, north: 0.01, dLon: 0.01, dLat: 0.01, nx: 3, ny: 1 };
const land = new Float32Array(3);
const population = Float32Array.from([100, 40, 60]);
const sites = Float32Array.from([0.002, 0.005, 0.006, 0.005, 0.022, 0.005]);

describe('service areas on the grid', () => {
  it('shares a cell among its sites and gives empty cells to the nearest site', () => {
    const areas = serviceAreas(spec, sites, land, population);
    // The middle cell centre (0.015) is nearer the third site (0.022) than the second (0.006).
    expect([...areas.cellSite]).toEqual([1, 2, 2]);
    expect([...areas.sitePopulation]).toEqual([50, 50, 100]);
    expect([...areas.siteCell]).toEqual([0, 0, 2]);
    // Residents per km² of the service area: half a cell each for the first two sites.
    const area = cellAreaKm2(spec, 0);
    expect(areas.siteDensity[0]).toBeCloseTo(50 / (area / 2), 3);
    expect(areas.siteDensity[2]).toBeCloseTo(100 / (2 * area), 3);
  });

  it('leaves cells outside the land mask unserved', () => {
    const areas = serviceAreas(spec, sites, Float32Array.from([0, Number.NaN, 0]), population);
    expect(areas.cellSite[1]).toBe(-1);
    expect([...areas.sitePopulation]).toEqual([50, 50, 60]);
  });
});

describe('cell network', () => {
  const hostFunction = {
    taxonomy: 'COM',
    imt: 'PGA' as const,
    imls: [0.1, 1],
    structural: [0, 0.5],
    fatality: [0, 0],
  };
  const result = cellNetwork({
    grid: spec,
    land,
    population,
    settlement: new Uint8Array(3),
    siteLonLat: sites,
    tS: Float32Array.from([4, 5, 6]),
    mmi: Float32Array.from([7, 4, 2]),
    hostFunction,
    hostLevel: Float32Array.from([1, 0, 0.55]),
    hostSigmaLn: 0,
  });

  it('takes arrival, demand and host-building loss from each site’s cell', () => {
    expect(result.synthetic).toBe(false);
    expect(result.siteCount).toBe(3);
    expect([...result.siteSArrivalS]).toEqual([4, 4, 6]);
    expect([...result.sitePeakDemand]).toEqual([55, 55, 1]);
    expect(result.siteLossRatio[0]).toBeCloseTo(0.5, 6);
    expect(result.siteLossRatio[2]).toBeCloseTo(0.25, 6);
    expect(result.decayS).toBe(DEMAND_DECAY_S);
  });

  it('generates synthetic sites when none are given', () => {
    const synthetic = cellNetwork({
      grid: spec,
      land,
      population,
      settlement: new Uint8Array(3).fill(2),
      siteLonLat: undefined,
      tS: new Float32Array(3),
      mmi: new Float32Array(3),
      hostFunction,
      hostLevel: new Float32Array(3),
      hostSigmaLn: 0,
    });
    expect(synthetic.synthetic).toBe(true);
    expect(synthetic.siteCount).toBeGreaterThan(5);
  });
});
