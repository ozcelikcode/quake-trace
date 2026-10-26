import type { RoadGraph } from '@/types/roads';
import { IMPAIRMENTS, type DistrictResponse, type RoutingResult } from '@/types/routing';

export interface ResponseStats {
  /** Median fire response over the reached districts, minutes. */
  medianBeforeMin: number;
  medianAfterMin: number;
  /** District with the largest increase, if any grew. */
  worst: { index: number; increaseMin: number } | null;
  /** Reached districts no fire crew or no hospital can reach by road. */
  cutOff: number;
  /** Closed bridges (two-way bridges counted once). */
  bridgesClosed: number;
  /** Length of streets slowed by debris, km (two-way roads counted once). */
  debrisKm: number;
}

function median(values: number[]): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 === 1
    ? (sorted[middle] ?? Number.NaN)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

const BRIDGE = IMPAIRMENTS.indexOf('bridgeClosed');

/** Response statistics over the districts in `reached` and the roads impaired by `timeS`. */
export function responseStats(
  routing: RoutingResult,
  reached: ReadonlySet<number>,
  timeS: number,
  graph: RoadGraph | undefined,
): ResponseStats {
  const responses = routing.districts.filter(
    (response) => reached.has(response.index) && Number.isFinite(response.fireBeforeMin),
  );
  const finiteAfter = responses.filter((response) => Number.isFinite(response.fireAfterMin));
  let worst: ResponseStats['worst'] = null;
  for (const response of finiteAfter) {
    const increaseMin = response.fireAfterMin - response.fireBeforeMin;
    if (increaseMin > (worst?.increaseMin ?? 0)) worst = { index: response.index, increaseMin };
  }
  const isCutOff = (response: DistrictResponse) =>
    !Number.isFinite(response.fireAfterMin) || !Number.isFinite(response.hospitalAfterMin);

  let bridgesClosed = 0;
  let debrisM = 0;
  const oneway = graph?.flags.oneway ?? 0;
  routing.impairedEdges.forEach((edge, i) => {
    if ((routing.impairedAtS[i] ?? Number.POSITIVE_INFINITY) > timeS) return;
    // Two-way roads are a pair of directed edges.
    const share = graph && ((graph.edgeFlags[edge] ?? 0) & oneway) === 0 ? 0.5 : 1;
    if (routing.impairment[i] === BRIDGE) bridgesClosed += share;
    else debrisM += (graph?.edgeLengthM[edge] ?? 0) * share;
  });

  return {
    medianBeforeMin: median(responses.map((response) => response.fireBeforeMin)),
    medianAfterMin: median(finiteAfter.map((response) => response.fireAfterMin)),
    worst,
    cutOff: responses.filter(isCutOff).length,
    bridgesClosed: Math.ceil(bridgesClosed),
    debrisKm: debrisM / 1000,
  };
}
