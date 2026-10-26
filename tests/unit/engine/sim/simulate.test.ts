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
    seed: 7,
  },
  grid,
  vs30: new Float32Array(cells).fill(400),
  stations: [
    { id: 'XX.NEAR', lon: 29.0, lat: 40.85 },
    { id: 'XX.FAR', lon: 29.9, lat: 41.15 },
    { id: 'XX.OUT', lon: 31.5, lat: 41.0 },
  ],
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

  it('is deterministic for a scenario and seed', () => {
    const again = simulate(input);
    expect(again.tS).toEqual(result.tS);
    expect(again.mmi).toEqual(result.mmi);
    expect(again.records.accelCmS2).toEqual(result.records.accelCmS2);
    const reseeded = simulate({ ...input, scenario: { ...input.scenario, seed: 8 } });
    expect(reseeded.records.accelCmS2).not.toEqual(result.records.accelCmS2);
    expect(reseeded.mmi).toEqual(result.mmi);
  });
});

describe('station records', () => {
  const { records } = simulate(input);
  const rate = records.sampleRateHz;
  const component = (station: number, c: number) =>
    records.accelCmS2.subarray(
      (station * 3 + c) * records.samples,
      (station * 3 + c + 1) * records.samples,
    );
  const peak = (values: Float32Array) => values.reduce((max, v) => Math.max(max, Math.abs(v)), 0);

  it('covers the stations inside the grid for the whole scenario at 100 Hz', () => {
    expect(records.stations.map((s) => s.id)).toEqual(['XX.NEAR', 'XX.FAR']);
    expect(rate).toBe(100);
    expect(records.accelCmS2).toHaveLength(2 * 3 * records.samples);
    const result = simulate(input);
    expect(records.samples).toBe(Math.floor(result.durationS * rate) + 1);
  });

  it('reaches the ASB14 median as the geometric mean of the horizontal peaks', () => {
    records.stations.forEach((station, index) => {
      const measured = Math.sqrt(peak(component(index, 1)) * peak(component(index, 2)));
      expect(measured / station.pgaCmS2).toBeCloseTo(1, 2);
    });
    const [near, far] = records.stations;
    expect(near?.pgaCmS2).toBeGreaterThan(far?.pgaCmS2 ?? Number.POSITIVE_INFINITY);
  });

  it('issues no early warning with fewer than four triggered stations', () => {
    expect(simulate(input).earlyWarning).toBeNull();
  });

  it('stays at the noise floor before the P arrival and triggers shortly after it', () => {
    records.stations.forEach((station, index) => {
      const beforeP = component(index, 0).subarray(0, Math.floor(station.pArrivalS * rate) - 5);
      expect(peak(beforeP)).toBeLessThan(0.3);
      expect(station.triggerS).not.toBeNull();
      expect(station.triggerS ?? 0).toBeGreaterThanOrEqual(station.pArrivalS - 0.02);
      expect(station.triggerS ?? 0).toBeLessThan(station.pArrivalS + 1);
      expect(station.sArrivalS).toBeGreaterThan(station.pArrivalS);
    });
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
