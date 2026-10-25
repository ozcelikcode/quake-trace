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
  startKm: number;
  endKm: number;
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
