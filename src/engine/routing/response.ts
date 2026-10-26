import { FACILITY_OUT_OF_SERVICE_FROM, type CriticalFacilityKind } from '@/types/damage';
import type { DistrictResponse, RoutingResult } from '@/types/routing';

import { PointIndex } from '../grid/point-index';
import { edgeSources, pathTo, shortestPaths } from './dijkstra';
import { IMPAIRMENT, roadState, type RoadStateInput } from './road-state';

/**
 * Emergency response on the road network after the shaking:
 *
 * - Response time per district: from the nearest fire station before the earthquake, and after
 *   it on the impaired roads of `road-state.ts` without stations whose building is likely out of
 *   service; and from the nearest hospital still in service. Each district is reached at the
 *   road node nearest to its population-weighted centre that fire crews could reach before the
 *   earthquake, so small disconnected pieces of the extract are skipped; facilities join at
 *   their nearest node. After the shaking, both join at the nearest node on a road still open,
 *   so only wider isolation (closed bridges) cuts a district off.
 * - Corridors: the routes from the fire station and to the hospital for every damaged district,
 *   weighted by its complete-loss-equivalent buildings, summed per edge.
 */

export interface ResponseFacility {
  kind: CriticalFacilityKind;
  lon: number;
  lat: number;
  lossRatio: number;
}

export interface ResponseDistrict {
  index: number;
  lon: number;
  lat: number;
  sArrivalS: number;
  /** Rescue demand: complete-loss-equivalent buildings. */
  buildingsLost: number;
}

export interface ResponseInput extends RoadStateInput {
  tS: Float32Array;
  facilities: readonly ResponseFacility[];
  districts: readonly ResponseDistrict[];
}

/** Road nodes are at most a few cells from any facility or district centre. */
const MAX_RING = 20;
/** Districts with less rescue demand get no corridor. */
const MIN_BUILDINGS_LOST = 1;

export function emergencyResponse(input: ResponseInput): RoutingResult {
  const { graph, grid } = input;
  const sources = edgeSources(graph);
  const roads = roadState(input, sources);
  const nodes = new PointIndex(grid, graph.nodeLonLat);
  // After the shaking, places join the network at a node on a road that is still open.
  const onOpenRoad = new Uint8Array(graph.nodeCount);
  for (let edge = 0; edge < graph.edgeCount; edge++) {
    if (Number.isFinite(roads.afterS[edge] ?? Number.POSITIVE_INFINITY)) {
      onOpenRoad[sources[edge] ?? 0] = 1;
      onOpenRoad[graph.edgeTargets[edge] ?? 0] = 1;
    }
  }
  const isOpen = (node: number) => onOpenRoad[node] === 1;

  const facilityNodes = (kind: CriticalFacilityKind, after: boolean) =>
    input.facilities.flatMap((facility) => {
      if (facility.kind !== kind) return [];
      if (after && facility.lossRatio >= FACILITY_OUT_OF_SERVICE_FROM) return [];
      const node = nodes.nearest(facility.lon, facility.lat, MAX_RING, after ? isOpen : undefined);
      return node < 0 ? [] : [node];
    });
  const fireBefore = shortestPaths(graph, roads.freeFlowS, facilityNodes('fireStation', false));
  const fireAfter = shortestPaths(graph, roads.afterS, facilityNodes('fireStation', true));
  const hospitalAfter = shortestPaths(graph, roads.afterS, facilityNodes('hospital', true));

  const usage = new Map<number, { weight: number; fromS: number }>();
  const addPath = (edges: number[], weight: number, fromS: number) => {
    for (const edge of edges) {
      const entry = usage.get(edge);
      if (entry) {
        entry.weight += weight;
        entry.fromS = Math.min(entry.fromS, fromS);
      } else {
        usage.set(edge, { weight, fromS });
      }
    }
  };

  const minutes = (seconds: number | undefined) => (seconds ?? Number.POSITIVE_INFINITY) / 60;
  const districts: DistrictResponse[] = input.districts.map((district) => {
    const reachable = (node: number) =>
      Number.isFinite(fireBefore.cost[node] ?? Number.POSITIVE_INFINITY);
    const before = nodes.nearest(district.lon, district.lat, MAX_RING, reachable);
    const node = nodes.nearest(
      district.lon,
      district.lat,
      MAX_RING,
      (candidate) => reachable(candidate) && isOpen(candidate),
    );
    const response = {
      index: district.index,
      fireBeforeMin: minutes(fireBefore.cost[before]),
      fireAfterMin: minutes(fireAfter.cost[node]),
      hospitalAfterMin: minutes(hospitalAfter.cost[node]),
    };
    if (node >= 0 && district.buildingsLost >= MIN_BUILDINGS_LOST) {
      if (Number.isFinite(response.fireAfterMin)) {
        addPath(pathTo(fireAfter, sources, node), district.buildingsLost, district.sArrivalS);
      }
      if (Number.isFinite(response.hospitalAfterMin)) {
        addPath(pathTo(hospitalAfter, sources, node), district.buildingsLost, district.sArrivalS);
      }
    }
    return response;
  });

  const corridors = [...usage.entries()].sort((a, b) => a[0] - b[0]);
  const maxWeight = corridors.reduce((max, [, entry]) => Math.max(max, entry.weight), 0);
  const impaired: number[] = [];
  for (let edge = 0; edge < graph.edgeCount; edge++) {
    if (roads.impairment[edge] !== IMPAIRMENT.none) impaired.push(edge);
  }

  return {
    impairedEdges: Uint32Array.from(impaired),
    // IMPAIRMENT codes 1 and 2 map onto IMPAIRMENTS indices 0 and 1.
    impairment: Uint8Array.from(impaired, (edge) => (roads.impairment[edge] ?? 1) - 1),
    impairedAtS: Float32Array.from(impaired, (edge) => {
      const cell = roads.edgeCell[edge] ?? -1;
      return cell < 0 ? Number.POSITIVE_INFINITY : (input.tS[cell] ?? Number.POSITIVE_INFINITY);
    }),
    corridorEdges: Uint32Array.from(corridors, ([edge]) => edge),
    corridorUsage: Float32Array.from(corridors, ([, entry]) =>
      maxWeight > 0 ? entry.weight / maxWeight : 0,
    ),
    corridorFromS: Float32Array.from(corridors, ([, entry]) => entry.fromS),
    districts,
  };
}
