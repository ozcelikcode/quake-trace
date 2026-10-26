/**
 * Multi-source shortest paths on a directed graph in compressed sparse row form (Dijkstra, 1959)
 * with a binary heap and lazy deletion. Edge costs must be non-negative; an infinite cost
 * removes the edge.
 */

export interface CsrGraph {
  nodeCount: number;
  /** Edges of node i are edgeOffsets[i] .. edgeOffsets[i + 1] - 1. */
  edgeOffsets: Uint32Array;
  edgeTargets: Uint32Array;
}

export interface ShortestPaths {
  /** Cost from the nearest source, Infinity where unreachable. */
  cost: Float64Array;
  /** Last edge on the path to each node, -1 for sources and unreachable nodes. */
  viaEdge: Int32Array;
}

class MinHeap {
  #keys = new Float64Array(1024);
  #values = new Int32Array(1024);
  size = 0;

  push(key: number, value: number): void {
    if (this.size === this.#keys.length) {
      const keys = new Float64Array(this.size * 2);
      keys.set(this.#keys);
      this.#keys = keys;
      const values = new Int32Array(this.size * 2);
      values.set(this.#values);
      this.#values = values;
    }
    let i = this.size++;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      const parentKey = this.#keys[parent] ?? 0;
      if (parentKey <= key) break;
      this.#keys[i] = parentKey;
      this.#values[i] = this.#values[parent] ?? 0;
      i = parent;
    }
    this.#keys[i] = key;
    this.#values[i] = value;
  }

  /** Removes the minimum; read `topKey` and `topValue` first. */
  pop(): void {
    const last = --this.size;
    const key = this.#keys[last] ?? 0;
    const value = this.#values[last] ?? 0;
    let i = 0;
    for (;;) {
      let child = 2 * i + 1;
      if (child >= last) break;
      const right = child + 1;
      if (right < last && (this.#keys[right] ?? 0) < (this.#keys[child] ?? 0)) child = right;
      if ((this.#keys[child] ?? 0) >= key) break;
      this.#keys[i] = this.#keys[child] ?? 0;
      this.#values[i] = this.#values[child] ?? 0;
      i = child;
    }
    this.#keys[i] = key;
    this.#values[i] = value;
  }

  get topKey(): number {
    return this.#keys[0] ?? 0;
  }

  get topValue(): number {
    return this.#values[0] ?? 0;
  }
}

export function shortestPaths(
  graph: CsrGraph,
  edgeCost: Float32Array,
  sources: Iterable<number>,
): ShortestPaths {
  const cost = new Float64Array(graph.nodeCount).fill(Number.POSITIVE_INFINITY);
  const viaEdge = new Int32Array(graph.nodeCount).fill(-1);
  const heap = new MinHeap();
  for (const source of sources) {
    if (cost[source] === 0) continue;
    cost[source] = 0;
    heap.push(0, source);
  }
  while (heap.size > 0) {
    const key = heap.topKey;
    const node = heap.topValue;
    heap.pop();
    if (key > (cost[node] ?? 0)) continue;
    const end = graph.edgeOffsets[node + 1] ?? 0;
    for (let edge = graph.edgeOffsets[node] ?? 0; edge < end; edge++) {
      const next = key + (edgeCost[edge] ?? Number.POSITIVE_INFINITY);
      const target = graph.edgeTargets[edge] ?? 0;
      if (next < (cost[target] ?? 0)) {
        cost[target] = next;
        viaEdge[target] = edge;
        heap.push(next, target);
      }
    }
  }
  return { cost, viaEdge };
}

/** Source node of every edge. */
export function edgeSources(graph: CsrGraph): Uint32Array {
  const sources = new Uint32Array(graph.edgeTargets.length);
  for (let node = 0; node < graph.nodeCount; node++) {
    sources.fill(node, graph.edgeOffsets[node] ?? 0, graph.edgeOffsets[node + 1] ?? 0);
  }
  return sources;
}

/** Edges of the shortest path to `target`, from the target back to its source. */
export function pathTo(paths: ShortestPaths, sources: Uint32Array, target: number): number[] {
  const edges: number[] = [];
  let node = target;
  for (let edge = paths.viaEdge[node] ?? -1; edge >= 0; edge = paths.viaEdge[node] ?? -1) {
    edges.push(edge);
    node = sources[edge] ?? 0;
  }
  return edges;
}
