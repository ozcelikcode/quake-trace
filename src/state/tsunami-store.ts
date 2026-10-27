import { create } from 'zustand';

import type { TsunamiResult } from '@/types/tsunami';

/**
 * `pending`: a scenario's tsunami is scheduled but not started. It starts when the shaking
 * playback ends or when the user asks for it (tsunami scale, tsunami summary), so the solver
 * does not compete with the first seconds of playback.
 */
export type TsunamiStatus = 'idle' | 'pending' | 'computing' | 'ready' | 'error';

/**
 * The tsunami of the current scenario, computed in its own worker after the shaking. Each run
 * carries a token so a result that arrives after a newer scenario started is dropped.
 */
interface TsunamiState {
  status: TsunamiStatus;
  token: number;
  result: TsunamiResult | null;
  /** Starts the scheduled run; null when nothing is scheduled. */
  pending: (() => void) | null;
  /** Whether the tsunami timeline scale opens when the result arrives (the user asked for it). */
  openWhenReady: boolean;
  /** Schedules the current scenario's run; a newer schedule replaces an older one. */
  schedule: (run: () => void) => void;
  /** Starts the scheduled run, if any. */
  request: (options?: { openScale?: boolean }) => void;
  /** Starts a run and returns its token. */
  start: () => number;
  succeed: (token: number, result: TsunamiResult) => boolean;
  fail: (token: number) => void;
}

export const useTsunamiStore = create<TsunamiState>()((set, get) => ({
  status: 'idle',
  token: 0,
  result: null,
  pending: null,
  openWhenReady: false,
  schedule: (run) => {
    set((state) => ({
      status: 'pending',
      token: state.token + 1,
      result: null,
      pending: run,
      openWhenReady: false,
    }));
  },
  request: ({ openScale = false } = {}) => {
    const { pending, status } = get();
    if (openScale && (status === 'pending' || status === 'computing')) set({ openWhenReady: true });
    if (!pending) return;
    set({ pending: null });
    pending();
  },
  start: () => {
    const token = get().token + 1;
    set({ status: 'computing', token, result: null });
    return token;
  },
  succeed: (token, result) => {
    if (get().token !== token) return false;
    set({ status: 'ready', result });
    return true;
  },
  fail: (token) => {
    if (get().token === token) set({ status: 'error', result: null });
  },
}));
