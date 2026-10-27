import type { AftershockCatalog } from './aftershocks';
import type { DistrictDamage, FacilityDamage } from './damage';
import type { GridSpec } from './grid';
import type { NetworkResult } from './network';
import type { RoutingResult } from './routing';
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

/** A recording site passed to the engine. */
export interface StationSite {
  id: string;
  lon: number;
  lat: number;
}

/** Record components, in storage order. */
export const RECORD_COMPONENTS = ['Z', 'N', 'E'] as const;
export type RecordComponent = (typeof RECORD_COMPONENTS)[number];

export interface StationRecord {
  id: string;
  lon: number;
  lat: number;
  epicentralKm: number;
  /** Joyner–Boore distance to the rupture, km. */
  rjbKm: number;
  vs30: number;
  pArrivalS: number;
  sArrivalS: number;
  /** ASB14 median PGA at the station (geometric mean of the horizontals), cm/s². */
  pgaCmS2: number;
  /** First STA/LTA trigger on the vertical component, s after origin; null if none. */
  triggerS: number | null;
}

/** Synthetic accelerograms for every station, starting at the origin time. */
export interface StationRecords {
  sampleRateHz: number;
  /** Samples per component. */
  samples: number;
  /**
   * Acceleration, cm/s²: station-major, then components in `RECORD_COMPONENTS` order; component
   * c of station s starts at (s × 3 + c) × samples.
   */
  accelCmS2: Float32Array<ArrayBuffer>;
  stations: StationRecord[];
}

/** What a network early-warning system would have known and when, from the station records. */
export interface EarlyWarning {
  /** First STA/LTA trigger in the network, s after origin. */
  firstTriggerS: number;
  /** Alert time: the last of those stations has 3 s of P wave. */
  alertS: number;
  epicenter: { lon: number; lat: number };
  depthKm: number;
  originS: number;
  /** Pd (peak displacement in the first 3 s of P, cm) and the magnitude it implies, per station. */
  stations: { id: string; pdCm: number; magnitude: number }[];
  /** Magnitude from Pd (Wu and Zhao, 2006), mean over the stations. */
  magnitude: number;
  /** Distance between estimated and true epicentres, km. */
  locationErrorKm: number;
}

/**
 * Everything a scenario produces. The shaking fields are indexed like `grid` (row-major,
 * north-up), an event-centred grid; districts, damage, network and routing refer to
 * `regionGrid`, the grid of the regional data.
 */
export interface SimulationResult {
  scenarioId: string;
  grid: GridSpec;
  regionGrid: GridSpec;
  /** Whether the shaking reaches the regional grid, where the impact modules run. */
  inRegion: boolean;
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
  records: StationRecords;
  /** Null when fewer than four stations trigger. */
  earlyWarning: EarlyWarning | null;
  /** Null when no building stock was given. */
  damage: { districts: DistrictDamage[]; facilities: FacilityDamage[] } | null;
  /** Cell sites and call demand; null without sites or damage inputs. */
  network: NetworkResult | null;
  /** Road closures, response times and corridors; null without a road network. */
  routing: RoutingResult | null;
  /** Synthetic aftershocks of the first three days. */
  aftershocks: AftershockCatalog;
  /** Time by which the S wave has crossed the grid and station shaking has ended, seconds. */
  durationS: number;
  computeMs: number;
}
