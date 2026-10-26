import { useEffect } from 'react';

import { TIMELINE_SCALES, usePlaybackStore } from '@/state/playback-store';

/** Controls that handle these keys themselves keep them. */
const INTERACTIVE =
  'button, a, input, textarea, select, [role="slider"], [role="tab"], [role="radio"], [contenteditable="true"]';

/**
 * Space plays or pauses; ←/→ step and Shift+←/→ jump by the active scale's steps (one and ten
 * seconds while shaking, designSystem.md).
 */
export function usePlaybackShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.target instanceof Element && event.target.closest(INTERACTIVE)) return;
      const playback = usePlaybackStore.getState();
      if (playback.durationS === 0) return;

      const { stepS, jumpS } = TIMELINE_SCALES[playback.scale];
      const step = event.shiftKey ? jumpS : stepS;
      if (event.key === ' ') playback.toggle();
      else if (event.key === 'ArrowRight') playback.seek(playback.timeS + step);
      else if (event.key === 'ArrowLeft') playback.seek(playback.timeS - step);
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);
}
