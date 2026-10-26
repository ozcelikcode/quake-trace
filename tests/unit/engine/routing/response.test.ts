import { describe, expect, it } from 'vitest';

import { SETTLEMENT } from '@/engine/grid/settlement';
import { emergencyResponse, type ResponseFacility } from '@/engine/routing/response';
import type { RoadGraph } from '@/types/roads';

const grid = { west: 0, north: 0.01, dLon: 0.01, dLat: 0.01, nx: 3, ny: 1 };

/**
 * Station at node 0, district at node 2. Direct route 0 → 1 → 2 (2 km, the second edge a
 * bridge) or detour 0 → 3 → 2 (4 km); rural primary roads at 90 km/h.
 */
const graph: RoadGraph = {
  nodeCount: 4,
  edgeCount: 4,
  nodeLonLat: Float32Array.from([0.005, 0.005, 0.015, 0.005, 0.0255, 0.005, 0.015, 0.009]),
  edgeOffsets: Uint32Array.from([0, 2, 3, 3, 4]),
  edgeTargets: Uint32Array.from([1, 3, 2, 2]),
  edgeLengthM: Float32Array.from([1000, 2000, 1000, 2000]),
  edgeClass: Uint8Array.from([2, 2, 2, 2]),
  edgeFlags: Uint8Array.from([0, 0, 1, 0]),
  classes: ['motorway', 'trunk', 'primary', 'secondary', 'tertiary'],
  flags: { bridge: 1, tunnel: 2, oneway: 4, link: 8 },
};

function respond(sa1G: number, facilities: ResponseFacility[]) {
  return emergencyResponse({
    graph,
    grid,
    settlement: new Uint8Array(3).fill(SETTLEMENT.rural),
    cellLossRatio: new Float32Array(3),
    sa1G: () => sa1G,
    tS: Float32Array.from([1, 2, 3]),
    facilities,
    districts: [{ index: 7, lon: 0.0255, lat: 0.005, sArrivalS: 3, buildingsLost: 10 }],
  });
}

const station: ResponseFacility = { kind: 'fireStation', lon: 0.005, lat: 0.005, lossRatio: 0 };
const hospital: ResponseFacility = { kind: 'hospital', lon: 0.005, lat: 0.005, lossRatio: 0 };
const minutesAt90 = (metres: number) => metres / (90 / 3.6) / 60;

describe('emergency response on the road network', () => {
  it('detours around a closed bridge', () => {
    const result = respond(1.5, [station, hospital]);
    const [district] = result.districts;
    expect(district?.index).toBe(7);
    expect(district?.fireBeforeMin).toBeCloseTo(minutesAt90(2000), 4);
    expect(district?.fireAfterMin).toBeCloseTo(minutesAt90(4000), 4);
    expect(district?.hospitalAfterMin).toBeCloseTo(minutesAt90(4000), 4);
    expect([...result.impairedEdges]).toEqual([2]);
    expect([...result.impairment]).toEqual([0]);
    expect([...result.impairedAtS]).toEqual([3]);
  });

  it('weights corridors by the district’s lost buildings and dates them by its S arrival', () => {
    const result = respond(1.5, [station, hospital]);
    expect([...result.corridorEdges]).toEqual([1, 3]);
    expect([...result.corridorUsage]).toEqual([1, 1]);
    expect([...result.corridorFromS]).toEqual([3, 3]);
  });

  it('drops facilities that are likely out of service', () => {
    const result = respond(0, [{ ...station, lossRatio: 0.3 }, hospital]);
    const [district] = result.districts;
    expect(district?.fireBeforeMin).toBeCloseTo(minutesAt90(2000), 4);
    expect(district?.fireAfterMin).toBe(Number.POSITIVE_INFINITY);
    expect(district?.hospitalAfterMin).toBeCloseTo(minutesAt90(2000), 4);
    expect(result.impairedEdges.length).toBe(0);
  });
});
