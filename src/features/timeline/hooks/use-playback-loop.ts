import { useEffect } from 'react';

import { usePlaybackStore } from '@/state/playback-store';

/** Longest wall-time step per frame, so a background tab does not jump the clock. */
const MAX_FRAME_S = 0.1;

/** Drives the simulation clock with requestAnimationFrame while playback is running. */
export function usePlaybackLoop(): void {
  const playing = usePlaybackStore((state) => state.playing);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let previous: number | undefined;
    const tick = (now: number) => {
      if (previous !== undefined) {
        usePlaybackStore.getState().advance(Math.min(MAX_FRAME_S, (now - previous) / 1000));
      }
      previous = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [playing]);
}
