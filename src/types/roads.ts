/** Directed road graph in compressed sparse row form (see pipeline datasets/roads.py). */
export interface RoadGraph {
  nodeCount: number;
  edgeCount: number;
  /** Interleaved [lon0, lat0, lon1, lat1, ...]. */
  nodeLonLat: Float32Array;
  /** Edges of node i are edgeOffsets[i] .. edgeOffsets[i + 1] - 1. */
  edgeOffsets: Uint32Array;
  edgeTargets: Uint32Array;
  edgeLengthM: Float32Array;
  /** Index into `classes`. */
  edgeClass: Uint8Array;
  /** Bitmask, see `flags`. */
  edgeFlags: Uint8Array;
  classes: string[];
  flags: Record<string, number>;
}
