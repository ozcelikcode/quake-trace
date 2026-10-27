import { create } from 'zustand';

import type { LiveEvent } from '@/types/live';

/** Which part of the merged catalogs the list and the map show. */
export const liveScopes = ['marmara', 'turkey', 'world'] as const;
export type LiveScope = (typeof liveScopes)[number];

/** Live catalog events shared by the live list and the map, and the one selected. */
interface LiveState {
  events: LiveEvent[];
  selectedId: string | null;
  scope: LiveScope;
  setEvents: (events: LiveEvent[]) => void;
  select: (id: string | null) => void;
  setScope: (scope: LiveScope) => void;
}

export const useLiveStore = create<LiveState>()((set) => ({
  events: [],
  selectedId: null,
  scope: 'turkey',
  setEvents: (events) => {
    set({ events });
  },
  select: (selectedId) => {
    set({ selectedId });
  },
  setScope: (scope) => {
    set({ scope, selectedId: null });
  },
}));
