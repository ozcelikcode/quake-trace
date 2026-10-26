/** How the shaking impairs a road edge: a closed bridge, or a street slowed by debris. */
export const IMPAIRMENTS = ['bridgeClosed', 'debris'] as const;
export type Impairment = (typeof IMPAIRMENTS)[number];

/** Response times of one district: from the nearest fire station and hospital, minutes. */
export interface DistrictResponse {
  /** Index into districts.geojson. */
  index: number;
  /** Before the earthquake, from the nearest fire station. */
  fireBeforeMin: number;
  /** After the shaking, from the nearest fire station still in service; Infinity if cut off. */
  fireAfterMin: number;
  /** After the shaking, from the nearest hospital still in service; Infinity if cut off. */
  hospitalAfterMin: number;
}

export interface RoutingResult {
  /** Impaired directed edges (indices into the road graph), with impairment and time. */
  impairedEdges: Uint32Array<ArrayBuffer>;
  /** Index into `IMPAIRMENTS`. */
  impairment: Uint8Array<ArrayBuffer>;
  /** S-wave arrival at the edge, s after origin. */
  impairedAtS: Float32Array<ArrayBuffer>;
  /** Edges on the response routes to damaged districts, with usage and first use. */
  corridorEdges: Uint32Array<ArrayBuffer>;
  /** Usage relative to the busiest edge, 0–1. */
  corridorUsage: Float32Array<ArrayBuffer>;
  /** Earliest S-wave arrival among the districts the edge serves, s after origin. */
  corridorFromS: Float32Array<ArrayBuffer>;
  districts: DistrictResponse[];
}
