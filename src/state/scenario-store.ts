import { create } from 'zustand';

import type { SimulationResult } from '@/types/simulation';

export type ScenarioStatus = 'idle' | 'computing' | 'ready' | 'error';

/** Where the running scenario comes from, for labels and real-data lookups. */
export type ScenarioOrigin =
  | { kind: 'preset' }
  | {
      kind: 'replay' | 'event';
      /** Real origin time, ms since the Unix epoch. */
      originMs: number;
      magnitude: number;
      place: string;
      /** Catalog and event id the parameters come from. */
      catalog: string;
      /** Fault the rupture was placed on and its distance from the epicentre. */
      faultId: string;
      faultDistanceKm: number;
    };

interface ScenarioState {
  status: ScenarioStatus;
  /** Scenario being computed or shown. */
  scenarioId: string | null;
  origin: ScenarioOrigin | null;
  result: SimulationResult | null;
  error: string | null;
  start: (scenarioId: string, origin: ScenarioOrigin) => void;
  succeed: (result: SimulationResult) => void;
  fail: (message: string) => void;
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
  fail: (message) => {
    set({ status: 'error', error: message });
  },
}));
