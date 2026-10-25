import { readSections, requireSection } from './binary-sections';
import { DataError } from './errors';
import type { DatasetEntry } from './manifest';

type GraphEntry = Extract<DatasetEntry, { format: 'csr-graph' }>;

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

export function decodeRoadGraph(buffer: ArrayBuffer, entry: GraphEntry): RoadGraph {
  const { layout } = entry;
  const views = readSections(buffer, layout.sections);
  const graph: RoadGraph = {
    nodeCount: layout.nodeCount,
    edgeCount: layout.edgeCount,
    nodeLonLat: requireSection(views, 'nodeLonLat', Float32Array),
    edgeOffsets: requireSection(views, 'edgeOffsets', Uint32Array),
    edgeTargets: requireSection(views, 'edgeTargets', Uint32Array),
    edgeLengthM: requireSection(views, 'edgeLengthM', Float32Array),
    edgeClass: requireSection(views, 'edgeClass', Uint8Array),
    edgeFlags: requireSection(views, 'edgeFlags', Uint8Array),
    classes: layout.classes,
    flags: layout.flags,
  };
  if (
    graph.nodeLonLat.length !== 2 * graph.nodeCount ||
    graph.edgeOffsets.length !== graph.nodeCount + 1 ||
    graph.edgeOffsets[graph.nodeCount] !== graph.edgeCount
  ) {
    throw new DataError('road graph sections disagree with the layout');
  }
  return graph;
}
