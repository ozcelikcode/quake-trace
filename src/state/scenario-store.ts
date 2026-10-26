import { create } from 'zustand';

import type { SimulationResult } from '@/types/simulation';

export type ScenarioStatus = 'idle' | 'computing' | 'ready' | 'error';
/** Why the last request failed: the computation, or a share link that cannot be used. */
export type ScenarioError = 'compute' | 'link';

/** Where the running scenario comes from, for labels and real-data lookups. */
export type ScenarioOrigin =
  | { kind: 'preset' }
  | { kind: 'custom'; faultId: string; seed: number }
  | {
      kind: 'replay' | 'event';
      /** Real origin time, ms since the Unix epoch. */
      originMs: number;
      magnitude: number;
      place: string;
      /** Catalog and event id the parameters come from. */
      catalog: string;
      /** Nearest mapped fault and its distance from the epicentre. */
      faultId: string;
      faultDistanceKm: number;
      /** On that fault, or at the epicentre with its geometry (far from every fault). */
      placement: 'fault' | 'epicentre';
    };

interface ScenarioState {
  status: ScenarioStatus;
  /** Scenario being computed or shown. */
  scenarioId: string | null;
  origin: ScenarioOrigin | null;
  result: SimulationResult | null;
  error: ScenarioError | null;
  start: (scenarioId: string, origin: ScenarioOrigin) => void;
  succeed: (result: SimulationResult) => void;
  fail: (error: ScenarioError) => void;
}

export const useScenarioStore = create<ScenarioState>()((set) => ({
  status: 'idle',
  scenarioId: null,
  origin: null,
  result: null,
  error: null,
  start: (scenarioId, origin) => {
    set({ status: 'computing', scenarioId, origin, error: null });
  },
  succeed: (result) => {
    set({ status: 'ready', scenarioId: result.scenarioId, result, error: null });
  },
  fail: (error) => {
    set({ status: 'error', error });
  },
}));
