export type LonLat = readonly [number, number];

/** Fault source geometry and kinematics, as prepared from EFSM20. */
export interface FaultSource {
  id: string;
  /** Top-edge trace, digitized with the right-hand rule (the fault dips to the right). */
  trace: LonLat[];
  dipDeg: number;
  rakeDeg: number;
  upperDepthKm: number;
  lowerDepthKm: number;
}

/** The part of a fault that ruptures in a scenario, measured along its trace. */
export interface RuptureSpec {
  fault: FaultSource;
  /**
   * Ruptured part of the trace, km from its start. When omitted, the Wells and Coppersmith
   * (1994) median area for `mw` is centred on the hypocentre (`mw` is then required).
   */
  startKm?: number;
  endKm?: number;
  hypocenterKm: number;
  hypocenterDepthKm: number;
  /** Moment magnitude; derived from the rupture area (Wells and Coppersmith, 1994) when omitted. */
  mw?: number;
}

export interface Scenario {
  id: string;
  rupture: RuptureSpec;
  /** Seed for every random draw (synthetic records), so a scenario always reproduces. */
  seed: number;
}

/** A real earthquake turned into a scenario (historical replay or live event). */
export interface ScenarioEvent {
  /** Stable key, also the scenario id. */
  id: string;
  /** Origin time, ms since the Unix epoch. */
  originMs: number;
  lon: number;
  lat: number;
  depthKm: number;
  magnitude: number;
  place: string;
  /** Catalog and event id the parameters come from, for attribution. */
  catalog: string;
  /** Known rupture extent as longitudes along the fault; otherwise sized from the magnitude. */
  extentLon?: readonly [number, number];
}

/**
 * A scenario built in the editor: a rupture of magnitude `mw` on one fault, sized from the
 * magnitude and centred on the hypocentre (`RuptureSpec` without an extent).
 */
export interface ScenarioDraft {
  faultId: string;
  mw: number;
  /** Hypocentre along the fault trace, km from its start. */
  hypocenterKm: number;
  depthKm: number;
  seed: number;
}
