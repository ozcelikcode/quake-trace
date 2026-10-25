import { create } from 'zustand';

import type { SimulationResult } from '@/types/simulation';

export type ScenarioStatus = 'idle' | 'computing' | 'ready' | 'error';

interface ScenarioState {
  status: ScenarioStatus;
  /** Preset being computed or shown. */
  presetId: string | null;
  result: SimulationResult | null;
  error: string | null;
  start: (presetId: string) => void;
  succeed: (result: SimulationResult) => void;
  fail: (message: string) => void;
}

export const useScenarioStore = create<ScenarioState>()((set) => ({
  status: 'idle',
  presetId: null,
  result: null,
  error: null,
  start: (presetId) => {
    set({ status: 'computing', presetId, error: null });
  },
  succeed: (result) => {
    set({ status: 'ready', presetId: result.scenarioId, result, error: null });
  },
  fail: (message) => {
    set({ status: 'error', error: message });
  },
}));
