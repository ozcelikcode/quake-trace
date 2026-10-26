import { create } from 'zustand';

import type { RecordComponent } from '@/types/simulation';

export type ObservedStatus = 'idle' | 'loading' | 'ready' | 'none' | 'error';

/** Real accelerations of one station from the origin on, cm/s², at the records' sample rate. */
export type ObservedComponents = Partial<Record<RecordComponent, Float32Array>>;

/**
 * Observed strong-motion records for a replayed or live earthquake, shown in telemetry in place
 * of the synthetic ones. Tied to the scenario they were fetched for.
 */
interface ObservedState {
  scenarioId: string | null;
  status: ObservedStatus;
  /** Keyed by station id (NET.STA). */
  records: Record<string, ObservedComponents>;
  start: (scenarioId: string) => void;
  succeed: (scenarioId: string, records: Record<string, ObservedComponents>) => void;
  fail: (scenarioId: string) => void;
  clear: () => void;
}

export const useObservedStore = create<ObservedState>()((set, get) => ({
  scenarioId: null,
  status: 'idle',
  records: {},
  start: (scenarioId) => {
    set({ scenarioId, status: 'loading', records: {} });
  },
  succeed: (scenarioId, records) => {
    if (get().scenarioId !== scenarioId) return;
    set({ status: Object.keys(records).length > 0 ? 'ready' : 'none', records });
  },
  fail: (scenarioId) => {
    if (get().scenarioId === scenarioId) set({ status: 'error', records: {} });
  },
  clear: () => {
    set({ scenarioId: null, status: 'idle', records: {} });
  },
}));
