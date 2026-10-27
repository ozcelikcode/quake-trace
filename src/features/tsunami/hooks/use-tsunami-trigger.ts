import { useEffect } from 'react';

import { usePlaybackStore } from '@/state/playback-store';
import { useTsunamiStore } from '@/state/tsunami-store';

/** Starts a scheduled tsunami once the shaking playback reaches its end. */
export function useTsunamiTrigger() {
  useEffect(
    () =>
      usePlaybackStore.subscribe((state) => {
        const end = state.extents.shaking;
        if (end > 0 && state.scale === 'shaking' && state.timeS >= end) {
          useTsunamiStore.getState().request();
        }
      }),
    [],
  );
}
