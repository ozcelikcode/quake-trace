import { create } from 'zustand';

import type { LiveEvent } from '@/types/live';

/** Live catalog events shared by the live list and the map, and the one selected. */
interface LiveState {
  events: LiveEvent[];
  selectedId: string | null;
  setEvents: (events: LiveEvent[]) => void;
  select: (id: string | null) => void;
}

export const useLiveStore = create<LiveState>()((set) => ({
  events: [],
  selectedId: null,
  setEvents: (events) => {
    set({ events });
  },
  select: (selectedId) => {
    set({ selectedId });
  },
}));
