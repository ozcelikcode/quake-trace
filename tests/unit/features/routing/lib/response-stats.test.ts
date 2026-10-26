import { describe, expect, it } from 'vitest';

import { responseStats } from '@/features/routing/lib/response-stats';
import type { RoadGraph } from '@/types/roads';
import type { RoutingResult } from '@/types/routing';

const routing: RoutingResult = {
  // A two-way street (edges 0 and 1) slowed by debris, a one-way closed bridge (edge 2).
  impairedEdges: Uint32Array.from([0, 1, 2]),
  impairment: Uint8Array.from([1, 1, 0]),
  impairedAtS: Float32Array.from([5, 5, 30]),
  corridorEdges: new Uint32Array(0),
  corridorUsage: new Float32Array(0),
  corridorFromS: new Float32Array(0),
  districts: [
    { index: 0, fireBeforeMin: 2, fireAfterMin: 3, hospitalAfterMin: 4 },
    { index: 1, fireBeforeMin: 4, fireAfterMin: 4.5, hospitalAfterMin: 5 },
    { index: 2, fireBeforeMin: 6, fireAfterMin: Number.POSITIVE_INFINITY, hospitalAfterMin: 1 },
    { index: 3, fireBeforeMin: 1, fireAfterMin: 9, hospitalAfterMin: 1 },
  ],
};

const graph: RoadGraph = {
  nodeCount: 3,
  edgeCount: 3,
  nodeLonLat: new Float32Array(6),
  edgeOffsets: Uint32Array.from([0, 1, 2, 3]),
  edgeTargets: Uint32Array.from([1, 0, 2]),
  edgeLengthM: Float32Array.from([800, 800, 300]),
  edgeClass: new Uint8Array(3),
  edgeFlags: Uint8Array.from([0, 0, 4]),
  classes: ['tertiary'],
  flags: { bridge: 1, tunnel: 2, oneway: 4, link: 8 },
};

describe('response statistics', () => {
  it('summarises the reached districts', () => {
    const stats = responseStats(routing, new Set([0, 1, 2]), 10, graph);
    expect(stats.medianBeforeMin).toBe(4);
    expect(stats.medianAfterMin).toBe(3.75);
    expect(stats.worst).toEqual({ index: 0, increaseMin: 1 });
    expect(stats.cutOff).toBe(1);
  });

  it('counts impaired roads once the S wave has reached them, two-way roads once', () => {
    expect(responseStats(routing, new Set(), 10, graph)).toMatchObject({
      debrisKm: 0.8,
      bridgesClosed: 0,
    });
    expect(responseStats(routing, new Set(), 30, graph).bridgesClosed).toBe(1);
  });
});
