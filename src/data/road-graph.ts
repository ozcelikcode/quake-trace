import type { RoadGraph } from '@/types/roads';

import { readSections, requireSection } from './binary-sections';
import { DataError } from './errors';
import type { DatasetEntry } from './manifest';

type GraphEntry = Extract<DatasetEntry, { format: 'csr-graph' }>;

/** Decodes roads.bin (see pipeline datasets/roads.py) without copying its sections. */
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
