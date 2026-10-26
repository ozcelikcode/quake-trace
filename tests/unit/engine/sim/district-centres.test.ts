import { describe, expect, it } from 'vitest';

import { districtCentres } from '@/engine/sim/district-centres';

describe('district centres', () => {
  const spec = { west: 0, north: 0.02, dLon: 0.01, dLat: 0.01, nx: 2, ny: 2 };
  // District 0: top row; district 1: bottom row, unpopulated.
  const districtCells = Float32Array.from([0, 0, 1, 1]);

  it('weights cell centres by residents and falls back to their mean', () => {
    const centres = districtCentres(spec, districtCells, Float32Array.from([300, 100, 0, 0]));
    expect(centres.get(0)?.lon).toBeCloseTo(0.0075, 6);
    expect(centres.get(0)?.lat).toBeCloseTo(0.015, 6);
    expect(centres.get(1)?.lon).toBeCloseTo(0.01, 6);
    expect(centres.get(1)?.lat).toBeCloseTo(0.005, 6);
  });
});
