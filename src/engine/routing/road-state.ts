import { cellIndex } from '@/lib/math/grid';
import { FACILITY_LIMITED_FROM } from '@/types/damage';
import type { GridSpec } from '@/types/grid';
import type { RoadGraph } from '@/types/roads';

import { SETTLEMENT } from '../grid/settlement';

/**
 * Travel times on the road graph before and after the shaking.
 *
 * - Free-flow speed: the legal car limits of the Karayolları Trafik Yönetmeliği, Article 100
 *   (50 km/h in settlements, 90 on two-way intercity roads, 110 on divided roads, 120 on
 *   motorways). Motorways take 120, trunk roads 110 and other classes 90, or 50 inside urban
 *   centre cells (`grid/settlement.ts`); motorways keep their limit there.
 * - Bridges: Hazus highway-bridge fragility for a bridge not classified as HWB1–HWB27 (HWB28;
 *   Hazus Earthquake Model Technical Manual v5.1, as published in the NHERI SimCenter Damage
 *   and Loss Model Library, `transportation_network/portfolio/Hazus v5.1/fragility.csv`,
 *   commit 192d280): medians of Sa(1.0 s) 0.8, 1.0, 1.2 and 1.7 g for slight to complete
 *   damage, β 0.6. OpenStreetMap does not record the bridge type, hence the unclassified class;
 *   the skew and span modifiers of Hazus are not applied. A bridge closes when extensive damage
 *   is more likely than not, that is when the median Sa(1.0 s) reaches 1.2 g.
 * - Debris: on secondary and tertiary roads in urban centre cells, travel time is divided by
 *   (1 − L), L the expected structural loss ratio of the cell's buildings (capped at 0.9): the
 *   passable street space shrinks with the lost building stock. Wider roads keep their speed,
 *   as cities designate their arterials as emergency routes to be kept clear; bridges and
 *   tunnels are exempt. An assumption standing in for a road-blockage model. Edges slowed by
 *   debris are reported from the facility "limited" threshold (L ≥ 5 %).
 */

const KMH = 1000 / 3600;
const MOTORWAY_KMH = 120;
const DIVIDED_KMH = 110;
const INTERCITY_KMH = 90;
const SETTLEMENT_KMH = 50;
export const BRIDGE_EXTENSIVE_SA1_G = 1.2;

/** Edge state after the shaking; codes 1 and 2 follow `IMPAIRMENTS` in `types/routing.ts`. */
export const IMPAIRMENT = { none: 0, bridgeClosed: 1, debris: 2 } as const;
/** Road classes narrow enough to be slowed by debris. */
const DEBRIS_CLASSES = new Set(['secondary', 'tertiary']);
const MAX_DEBRIS_LOSS = 0.9;

export interface RoadStateInput {
  graph: RoadGraph;
  grid: GridSpec;
  settlement: Uint8Array;
  /** Expected structural loss ratio of the buildings per cell. */
  cellLossRatio: Float32Array;
  /** Median Sa(1.0 s) at a point, g. */
  sa1G: (lon: number, lat: number) => number;
}

export interface RoadState {
  /** Grid cell of each edge's midpoint, -1 outside the grid. */
  edgeCell: Int32Array;
  freeFlowS: Float32Array;
  /** Travel time after the shaking, Infinity on closed edges. */
  afterS: Float32Array;
  /** `IMPAIRMENT` code per edge. */
  impairment: Uint8Array;
}

export function speedKmh(roadClass: string, urbanCentre: boolean): number {
  if (roadClass === 'motorway') return MOTORWAY_KMH;
  if (urbanCentre) return SETTLEMENT_KMH;
  return roadClass === 'trunk' ? DIVIDED_KMH : INTERCITY_KMH;
}

export function roadState(input: RoadStateInput, edgeSource: Uint32Array): RoadState {
  const { graph, grid } = input;
  const bridge = graph.flags.bridge ?? 0;
  const tunnel = graph.flags.tunnel ?? 0;
  const edgeCell = new Int32Array(graph.edgeCount);
  const freeFlowS = new Float32Array(graph.edgeCount);
  const afterS = new Float32Array(graph.edgeCount);
  const impairment = new Uint8Array(graph.edgeCount);
  // Bridges are short and often carry both directions, so Sa(1.0 s) is cached per cell.
  const saByCell = new Map<number, number>();

  for (let edge = 0; edge < graph.edgeCount; edge++) {
    const from = edgeSource[edge] ?? 0;
    const to = graph.edgeTargets[edge] ?? 0;
    const lon = ((graph.nodeLonLat[2 * from] ?? 0) + (graph.nodeLonLat[2 * to] ?? 0)) / 2;
    const lat = ((graph.nodeLonLat[2 * from + 1] ?? 0) + (graph.nodeLonLat[2 * to + 1] ?? 0)) / 2;
    const cell = cellIndex(grid, lon, lat);
    edgeCell[edge] = cell;
    const roadClass = graph.classes[graph.edgeClass[edge] ?? 0] ?? '';
    const urbanCentre = cell >= 0 && input.settlement[cell] === SETTLEMENT.centre;
    const time = (graph.edgeLengthM[edge] ?? 0) / (speedKmh(roadClass, urbanCentre) * KMH);
    freeFlowS[edge] = time;

    const flags = graph.edgeFlags[edge] ?? 0;
    afterS[edge] = time;
    if (flags & bridge) {
      let sa = saByCell.get(cell);
      if (sa === undefined) {
        sa = input.sa1G(lon, lat);
        saByCell.set(cell, sa);
      }
      if (sa >= BRIDGE_EXTENSIVE_SA1_G) {
        impairment[edge] = IMPAIRMENT.bridgeClosed;
        afterS[edge] = Number.POSITIVE_INFINITY;
      }
    } else if (urbanCentre && DEBRIS_CLASSES.has(roadClass) && !(flags & tunnel)) {
      const loss = Math.min(MAX_DEBRIS_LOSS, input.cellLossRatio[cell] ?? 0);
      afterS[edge] = time / (1 - loss);
      if (loss >= FACILITY_LIMITED_FROM) impairment[edge] = IMPAIRMENT.debris;
    }
  }
  return { edgeCell, freeFlowS, afterS, impairment };
}
