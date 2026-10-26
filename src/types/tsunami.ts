import type { GridSpec } from './grid';

/** Tsunami at the coast of one district. */
export interface CoastalTsunami {
  /** Index into districts.geojson. */
  index: number;
  /** First time the sea at the district's coast moves by the arrival threshold, s. */
  arrivalS: number;
  /** Highest sea surface along the district's coast, m. */
  maxEtaM: number;
  /** Where that maximum occurs. */
  lon: number;
  lat: number;
}

/** A scenario's tsunami: sea-surface frames on the display grid and coastal summaries. */
export interface TsunamiResult {
  scenarioId: string;
  durationS: number;
  frameIntervalS: number;
  frameCount: number;
  /** Display grid (the 1 km engine grid); frames cover only its sea cells. */
  grid: GridSpec;
  /** Sea cells of the display grid, as grid indices. */
  wetCells: Int32Array<ArrayBuffer>;
  /** Sea surface in mm: frame-major, frame f of sea cell k at f × wetCells.length + k. */
  framesMm: Int16Array<ArrayBuffer>;
  /** Highest sea surface per sea cell, m. */
  maxEtaM: Float32Array<ArrayBuffer>;
  /** Arrival per sea cell, s; Infinity where the threshold is never reached. */
  arrivalS: Float32Array<ArrayBuffer>;
  coast: CoastalTsunami[];
  source: { slipM: number; maxUpliftM: number; minUpliftM: number };
  computeMs: number;
}
