import { describe, expect, it } from 'vitest';

import { districtImpacts, simulate, type SimulationInput } from '@/engine/sim/simulate';
import type { GridSpec } from '@/types/grid';

// A small grid (0.05° cells) around a straight east-west fault.
const grid: GridSpec = { west: 28, north: 41.2, dLon: 0.05, dLat: 0.05, nx: 40, ny: 16 };
const cells = grid.nx * grid.ny;

const input: SimulationInput = {
  scenario: {
    id: 'test',
    rupture: {
      fault: {
        id: 'fault',
        trace: [
          [28.3, 40.8],
          [29.7, 40.8],
        ],
        dipDeg: 90,
        rakeDeg: 180,
        upperDepthKm: 0,
        lowerDepthKm: 18,
      },
      startKm: 20,
      endKm: 100,
      hypocenterKm: 60,
      hypocenterDepthKm: 12,
    },
  },
  grid,
  vs30: new Float32Array(cells).fill(400),
};

describe('scenario simulation', () => {
  const result = simulate(input);

  it('produces fields for every cell, S after P', () => {
    expect(result.tP).toHaveLength(cells);
    for (let i = 0; i < cells; i++) {
      expect(result.tS[i]).toBeGreaterThan(result.tP[i] ?? Number.NaN);
      expect(result.mmi[i]).toBeGreaterThanOrEqual(1);
      expect(result.mmi[i]).toBeLessThanOrEqual(10);
    }
    expect(result.durationS).toBeGreaterThan(Math.max(...result.tS));
  });

  it('reaches the epicentre first, about one vertical travel time after origin', () => {
    const minP = Math.min(...result.tP);
    // Vertical P travel time from 12 km depth: 12 / 5.8 ≈ 2.07 s.
    expect(minP).toBeGreaterThan(1.5);
    expect(minP).toBeLessThan(2.6);
  });

  it('shakes hardest along the rupture', () => {
    const at = (lon: number, lat: number) => {
      const col = Math.floor((lon - grid.west) / grid.dLon);
      const row = Math.floor((grid.north - lat) / grid.dLat);
      return result.mmi[row * grid.nx + col] ?? Number.NaN;
    };
    expect(at(29, 40.81)).toBeGreaterThan(at(29, 41.15));
    expect(at(29, 40.81)).toBeGreaterThan(7);
  });

  it('is deterministic', () => {
    const again = simulate(input);
    expect(again.tS).toEqual(result.tS);
    expect(again.mmi).toEqual(result.mmi);
  });
});

describe('district impacts', () => {
  it('keep the earliest arrivals and strongest intensity per district, by S arrival', () => {
    const districtCells = Float32Array.from([0, 0, 1, Number.NaN]);
    const impacts = districtImpacts(
      districtCells,
      Float32Array.from([5, 4, 2, 1]),
      Float32Array.from([9, 7, 3, 2]),
      Float32Array.from([6, 7, 8, 9]),
    );
    expect(impacts).toEqual([
      { index: 1, pArrivalS: 2, sArrivalS: 3, maxMmi: 8 },
      { index: 0, pArrivalS: 4, sArrivalS: 7, maxMmi: 7 },
    ]);
  });
});
