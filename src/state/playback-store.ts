import { create } from 'zustand';

export const PLAYBACK_SPEEDS = [0.5, 1, 2, 5, 10] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

export function isPlaybackSpeed(value: number): value is PlaybackSpeed {
  return (PLAYBACK_SPEEDS as readonly number[]).includes(value);
}

/** The single simulation clock (memory-bank/systemPatterns.md, "Single clock"). */
interface PlaybackState {
  /** Seconds after the origin time. */
  timeS: number;
  durationS: number;
  playing: boolean;
  speed: PlaybackSpeed;
  /** Rewinds to the origin for a new scenario of the given duration and starts playing. */
  load: (durationS: number) => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (timeS: number) => void;
  setSpeed: (speed: PlaybackSpeed) => void;
  /** Moves the clock by `elapsedS` of wall time, scaled by the speed; stops at the end. */
  advance: (elapsedS: number) => void;
}

const clamp = (value: number, max: number) => Math.min(max, Math.max(0, value));

export const usePlaybackStore = create<PlaybackState>()((set) => ({
  timeS: 0,
  durationS: 0,
  playing: false,
  speed: 1,
  load: (durationS) => {
    set({ timeS: 0, durationS, playing: true });
  },
  play: () => {
    set((state) => ({
      playing: state.durationS > 0,
      // Playing from the end starts over.
      timeS: state.timeS >= state.durationS ? 0 : state.timeS,
    }));
  },
  pause: () => {
    set({ playing: false });
  },
  toggle: () => {
    set((state) =>
      state.playing
        ? { playing: false }
        : {
            playing: state.durationS > 0,
            timeS: state.timeS >= state.durationS ? 0 : state.timeS,
          },
    );
  },
  seek: (timeS) => {
    set((state) => ({ timeS: clamp(timeS, state.durationS) }));
  },
  setSpeed: (speed) => {
    set({ speed });
  },
  advance: (elapsedS) => {
    set((state) => {
      if (!state.playing) return state;
      const timeS = clamp(state.timeS + elapsedS * state.speed, state.durationS);
      return { timeS, playing: timeS < state.durationS };
    });
  },
}));
