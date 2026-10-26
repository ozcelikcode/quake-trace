import { create } from 'zustand';

import type { TsunamiResult } from '@/types/tsunami';

export type TsunamiStatus = 'idle' | 'computing' | 'ready' | 'error';

/**
 * The tsunami of the current scenario, computed in its own worker after the shaking. Each run
 * carries a token so a result that arrives after a newer scenario started is dropped.
 */
interface TsunamiState {
  status: TsunamiStatus;
  token: number;
  result: TsunamiResult | null;
  /** Starts a run and returns its token. */
  start: () => number;
  succeed: (token: number, result: TsunamiResult) => boolean;
  fail: (token: number) => void;
}

export const useTsunamiStore = create<TsunamiState>()((set, get) => ({
  status: 'idle',
  token: 0,
  result: null,
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
