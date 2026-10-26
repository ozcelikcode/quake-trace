import { create } from 'zustand';

import type { ScenarioDraft } from '@/types/scenario';

/** The scenario being edited, shared by the editor form and the map preview. */
interface EditorState {
  draft: ScenarioDraft | null;
  setDraft: (draft: ScenarioDraft) => void;
  /** Moves the hypocentre to a point on a fault picked on the map. */
  pick: (faultId: string, hypocenterKm: number) => void;
}

export const useEditorStore = create<EditorState>()((set) => ({
  draft: null,
  setDraft: (draft) => {
    set({ draft });
  },
  pick: (faultId, hypocenterKm) => {
    set((state) => (state.draft ? { draft: { ...state.draft, faultId, hypocenterKm } } : state));
  },
}));
