import type { GridSpec } from './grid';
import type { LonLat } from './scenario';

export interface RuptureSummary {
  mw: number;
  lengthKm: number;
  widthKm: number;
  areaKm2: number;
  hypocenter: { lon: number; lat: number; depthKm: number };
  /** Top edge of the ruptured part of the fault. */
  trace: LonLat[];
  /** Time (s after origin) at which the rupture front reaches each trace vertex. */
  traceTimesS: number[];
  ruptureDurationS: number;
}

export interface DistrictImpact {
  /** Index into districts.geojson. */
  index: number;
  pArrivalS: number;
  sArrivalS: number;
  maxMmi: number;
}

/** Everything a scenario produces, indexed like the grid (row-major, north-up). */
export interface SimulationResult {
  scenarioId: string;
  grid: GridSpec;
  /** First P-wave arrival per cell, seconds after origin. */
  tP: Float32Array<ArrayBuffer>;
  /** First S-wave arrival per cell, seconds after origin. */
  tS: Float32Array<ArrayBuffer>;
  /** Median peak ground acceleration, g. */
  pgaG: Float32Array<ArrayBuffer>;
  /** Median peak ground velocity, cm/s. */
  pgvCms: Float32Array<ArrayBuffer>;
  /** Modified Mercalli intensity (1–10). */
  mmi: Float32Array<ArrayBuffer>;
  rupture: RuptureSummary;
  districts: DistrictImpact[];
  /** Time by which the S wave has crossed the whole grid, rounded up, seconds. */
  durationS: number;
  computeMs: number;
}
