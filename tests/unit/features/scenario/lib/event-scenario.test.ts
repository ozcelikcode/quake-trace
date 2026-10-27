import { describe, expect, it } from 'vitest';

import type { Faults, WorldFaults } from '@/data/schemas';
import { ON_FAULT_KM, scenarioFromEvent } from '@/features/scenario/lib/event-scenario';
import { bearingDeg, haversineKm } from '@/lib/math/geo';

const range = (avg: number) => ({ min: avg, avg, max: avg });

/** One east–west strike-slip fault along 40.8° N from 28° to 29° E. */
const faults: Faults = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [28, 40.8],
          [29, 40.8],
        ],
      },
      properties: {
        id: 'TEST01',
        faultType: 'right-lateral',
        strikeDeg: range(90),
        dipDeg: range(90),
        rakeDeg: range(180),
        upperDepthKm: 0,
        lowerDepthKm: 18,
        lengthKm: 84,
        widthKm: range(18),
        slipRateMmYr: { min: 10, mean: 15, max: 20 },
        mwMax: { p05: 6.9, avg: 7.1, p95: 7.4 },
      },
    },
  ],
};

const event = (lat: number) => ({
  id: 'ev',
  originMs: 0,
  lon: 28.5,
  lat,
  depthKm: 10,
  magnitude: 5.5,
  place: 'test',
  catalog: 'TEST 1',
});

describe('placing a catalog earthquake', () => {
  it('ruptures the nearest fault when the epicentre is close to it', () => {
    // 0.05° north of the trace: about 5.6 km.
    const placed = scenarioFromEvent(event(40.85), faults);
    expect(placed.placement).toBe('fault');
    expect(placed.scenario.rupture.fault.id).toBe('TEST01');
    expect(placed.faultDistanceKm).toBeCloseTo(5.56, 1);
  });

  it('ruptures at a far epicentre along the strike of the nearest fault', () => {
    // 0.3° north: about 33 km, beyond the on-fault distance.
    const placed = scenarioFromEvent(event(41.1), faults);
    expect(placed.faultDistanceKm).toBeGreaterThan(ON_FAULT_KM);
    expect(placed).toMatchObject({ placement: 'epicentre', faultId: 'TEST01' });
    const { fault, hypocenterKm } = placed.scenario.rupture;
    const [start, end] = fault.trace;
    if (!start || !end) throw new Error('trace');
    // The hypocentre (middle of the trace) is the epicentre; the strike stays east–west.
    expect(haversineKm(start[0], start[1], 28.5, 41.1)).toBeCloseTo(hypocenterKm, 6);
    expect(haversineKm(end[0], end[1], 28.5, 41.1)).toBeCloseTo(hypocenterKm, 6);
    // Initial great-circle bearing of a 120 km line at 41° N: within a degree of east.
    expect(Math.abs(bearingDeg(start[0], start[1], end[0], end[1]) - 90)).toBeLessThan(1);
    expect(fault).toMatchObject({ dipDeg: 90, rakeDeg: 180, lowerDepthKm: 18 });
    expect(placed.scenario.rupture.mw).toBe(5.5);
  });
});

describe('placing an earthquake outside the regional catalogue', () => {
  const worldFaults: WorldFaults = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        // The regional fault's own world copy must not compete with it.
        geometry: {
          type: 'LineString',
          coordinates: [
            [28, 40.81],
            [29, 40.81],
          ],
        },
        properties: {
          id: 'TEST01',
          kind: 'right-lateral',
          dipDeg: 90,
          rakeDeg: 180,
          upperDepthKm: 0,
          lowerDepthKm: 18,
          slipRateMmYr: 15,
          catalog: 'EFSM20',
        },
      },
      {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [36.5, 36.8],
            [37.5, 37.6],
          ],
        },
        properties: {
          id: 'GEM-EAF',
          kind: 'left-lateral',
          dipDeg: 85,
          rakeDeg: 0,
          upperDepthKm: 0,
          lowerDepthKm: 20,
          slipRateMmYr: 10,
          catalog: 'GEM Faulted Earth',
        },
      },
    ],
  };

  it('ruptures the nearest world fault with its own parameters', () => {
    const placed = scenarioFromEvent(
      { ...event(37.2), lon: 37.0, magnitude: 7.8 },
      faults,
      worldFaults,
    );
    expect(placed.faultId).toBe('GEM-EAF');
    expect(placed.placement).toBe('fault');
    expect(placed.scenario.rupture.fault.rakeDeg).toBe(0);
  });

  it('keeps regional events on the regional fault', () => {
    expect(scenarioFromEvent(event(40.85), faults, worldFaults).faultId).toBe('TEST01');
    expect(
      scenarioFromEvent(event(40.85), faults, worldFaults).scenario.rupture.fault.trace,
    ).toEqual(faults.features[0]?.geometry.coordinates);
  });
});
