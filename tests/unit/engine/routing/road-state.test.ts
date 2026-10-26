import { describe, expect, it } from 'vitest';

import { SETTLEMENT } from '@/engine/grid/settlement';
import { edgeSources } from '@/engine/routing/dijkstra';
import {
  BRIDGE_EXTENSIVE_SA1_G,
  IMPAIRMENT,
  roadState,
  speedKmh,
} from '@/engine/routing/road-state';
import type { RoadGraph } from '@/types/roads';

const grid = { west: 0, north: 0.01, dLon: 0.01, dLat: 0.01, nx: 2, ny: 1 };

/** Four one-way edges of 1 km: a tertiary street and a primary road in cell 0, a bridge and a
 * tertiary tunnel in cell 1. */
function graph(): RoadGraph {
  return {
    nodeCount: 5,
    edgeCount: 4,
    nodeLonLat: Float32Array.from([
      0.002, 0.005, 0.004, 0.005, 0.012, 0.005, 0.014, 0.005, 0.016, 0.005,
    ]),
    edgeOffsets: Uint32Array.from([0, 2, 2, 3, 4, 4]),
    edgeTargets: Uint32Array.from([1, 1, 3, 4]),
    edgeLengthM: Float32Array.from([1000, 1000, 1000, 1000]),
    edgeClass: Uint8Array.from([4, 2, 2, 4]),
    edgeFlags: Uint8Array.from([0, 0, 1, 2]),
    classes: ['motorway', 'trunk', 'primary', 'secondary', 'tertiary'],
    flags: { bridge: 1, tunnel: 2, oneway: 4, link: 8 },
  };
}

function state(sa1G: number, loss: number) {
  const roads = graph();
  return roadState(
    {
      graph: roads,
      grid,
      settlement: Uint8Array.from([SETTLEMENT.centre, SETTLEMENT.centre]),
      cellLossRatio: Float32Array.from([loss, loss]),
      sa1G: () => sa1G,
    },
    edgeSources(roads),
  );
}

describe('free-flow speeds (Karayolları Trafik Yönetmeliği, Article 100)', () => {
  it('uses the car limits by road class and settlement', () => {
    expect(speedKmh('motorway', true)).toBe(120);
    expect(speedKmh('trunk', false)).toBe(110);
    expect(speedKmh('primary', false)).toBe(90);
    expect(speedKmh('tertiary', true)).toBe(50);
  });

  it('turns length into time', () => {
    expect(state(0, 0).freeFlowS[0]).toBeCloseTo(1000 / (50 / 3.6), 3);
  });
});

describe('road impairment after the shaking', () => {
  it('closes a bridge from the Hazus HWB28 extensive median, Sa(1.0) 1.2 g', () => {
    expect(BRIDGE_EXTENSIVE_SA1_G).toBe(1.2);
    expect(state(1.19, 0).afterS[2]).toBeCloseTo(state(0, 0).freeFlowS[2] ?? 0, 6);
    const closed = state(1.2, 0);
    expect(closed.afterS[2]).toBe(Number.POSITIVE_INFINITY);
    expect(closed.impairment[2]).toBe(IMPAIRMENT.bridgeClosed);
  });

  it('slows narrow urban streets by 1 / (1 − loss) and leaves wider roads and tunnels', () => {
    const slowed = state(0, 0.3);
    expect(slowed.afterS[0]).toBeCloseTo((slowed.freeFlowS[0] ?? 0) / 0.7, 3);
    expect(slowed.impairment[0]).toBe(IMPAIRMENT.debris);
    expect(slowed.afterS[1]).toBeCloseTo(slowed.freeFlowS[1] ?? 0, 6);
    expect(slowed.afterS[3]).toBeCloseTo(slowed.freeFlowS[3] ?? 0, 6);
    // Below the 5 % reporting threshold the street is slowed but not reported.
    expect(state(0, 0.04).impairment[0]).toBe(IMPAIRMENT.none);
  });
});
