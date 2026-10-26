import { describe, expect, it } from 'vitest';

import { cellAreaKm2, SETTLEMENT } from '@/engine/grid/settlement';
import { siteAreaKm2, syntheticSites } from '@/engine/network/synthetic-sites';

const spec = { west: 28, north: 41.2, dLon: 0.01, dLat: 0.01, nx: 40, ny: 40 };
const cells = spec.nx * spec.ny;
const land = new Float32Array(cells);

function sitesFor(settlement: number): Float32Array {
  return syntheticSites(spec, new Uint8Array(cells).fill(settlement), land, 1);
}

function areaKm2(): number {
  let area = 0;
  for (let row = 0; row < spec.ny; row++) area += cellAreaKm2(spec, row) * spec.nx;
  return area;
}

describe('synthetic cell sites (ITU-R M.2135-1, Table 8-4 inter-site distances)', () => {
  it('covers (√3/2)·ISD² per hexagonal site', () => {
    expect(siteAreaKm2(0.5)).toBeCloseTo(0.21651, 5);
  });

  it.each([
    [SETTLEMENT.centre, 0.5],
    [SETTLEMENT.cluster, 1.299],
    [SETTLEMENT.rural, 1.732],
  ])('places the density of class %i (ISD %f km) within 10 %', (settlement, isd) => {
    const expected = areaKm2() / siteAreaKm2(isd);
    const count = sitesFor(settlement).length / 2;
    expect(Math.abs(count - expected) / expected).toBeLessThan(0.1);
  });

  it('keeps sites inside their land cells and is reproducible', () => {
    const masked = land.slice();
    masked.fill(Number.NaN, 0, cells / 2);
    const sites = syntheticSites(spec, new Uint8Array(cells).fill(SETTLEMENT.centre), masked);
    // The masked half is the northern twenty rows.
    for (let i = 1; i < sites.length; i += 2) expect(sites[i]).toBeLessThan(41.0 + 1e-6);
    expect(sites).toEqual(
      syntheticSites(spec, new Uint8Array(cells).fill(SETTLEMENT.centre), masked),
    );
  });
});
