import { describe, expect, it } from 'vitest';

import { edgeSources, pathTo, shortestPaths, type CsrGraph } from '@/engine/routing/dijkstra';
import { createRandom } from '@/engine/random/random';

function randomGraph(seed: number, nodeCount: number, edgesPerNode: number) {
  const random = createRandom(seed);
  const edgeOffsets = new Uint32Array(nodeCount + 1);
  const targets: number[] = [];
  const costs: number[] = [];
  for (let node = 0; node < nodeCount; node++) {
    for (let k = 0; k < edgesPerNode; k++) {
      targets.push(Math.floor(random.next() * nodeCount));
      // Some edges removed with an infinite cost.
      costs.push(random.next() < 0.1 ? Number.POSITIVE_INFINITY : random.next() * 100);
    }
    edgeOffsets[node + 1] = targets.length;
  }
  const graph: CsrGraph = { nodeCount, edgeOffsets, edgeTargets: Uint32Array.from(targets) };
  return { graph, costs: Float32Array.from(costs) };
}

/** Reference: Bellman–Ford relaxation until nothing changes. */
function bellmanFord(graph: CsrGraph, costs: Float32Array, sources: number[]): Float64Array {
  const cost = new Float64Array(graph.nodeCount).fill(Number.POSITIVE_INFINITY);
  for (const source of sources) cost[source] = 0;
  const from = edgeSources(graph);
  for (let changed = true; changed;) {
    changed = false;
    for (let edge = 0; edge < costs.length; edge++) {
      const next = (cost[from[edge] ?? 0] ?? 0) + (costs[edge] ?? 0);
      const target = graph.edgeTargets[edge] ?? 0;
      if (next < (cost[target] ?? 0)) {
        cost[target] = next;
        changed = true;
      }
    }
  }
  return cost;
}

describe('multi-source Dijkstra', () => {
  it.each([1, 2, 3, 4, 5])('equals Bellman–Ford on random graph %i', (seed) => {
    const { graph, costs } = randomGraph(seed, 300, 3);
    const sources = [0, 17, 150];
    const reference = bellmanFord(graph, costs, sources);
    const { cost } = shortestPaths(graph, costs, sources);
    for (let node = 0; node < graph.nodeCount; node++) {
      if (Number.isFinite(reference[node] ?? 0)) {
        expect(cost[node]).toBeCloseTo(reference[node] ?? 0, 6);
      } else {
        expect(cost[node]).toBe(Number.POSITIVE_INFINITY);
      }
    }
  });

  it('reconstructs paths whose edge costs add up to the node cost', () => {
    const { graph, costs } = randomGraph(9, 200, 3);
    const paths = shortestPaths(graph, costs, [5]);
    const from = edgeSources(graph);
    for (let node = 0; node < graph.nodeCount; node++) {
      if (!Number.isFinite(paths.cost[node] ?? 0)) continue;
      const edges = pathTo(paths, from, node);
      const total = edges.reduce((sum, edge) => sum + (costs[edge] ?? 0), 0);
      expect(total).toBeCloseTo(paths.cost[node] ?? 0, 4);
      if (edges.length > 0) expect(from[edges.at(-1) ?? 0]).toBe(5);
    }
  });
});
