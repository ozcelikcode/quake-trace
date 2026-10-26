import { create } from 'zustand';

/**
 * Timeline scales (memory-bank/simulationModels.md, "Timeline"): each spans its own part of the
 * scenario and offers speeds and keyboard steps that suit it.
 */
export const TIMELINE_SCALES = {
  shaking: { speeds: [0.5, 1, 2, 5, 10], defaultSpeed: 1, stepS: 1, jumpS: 10 },
  tsunami: { speeds: [10, 30, 60, 120], defaultSpeed: 30, stepS: 10, jumpS: 60 },
} as const;
export type TimelineScale = keyof typeof TIMELINE_SCALES;
export const timelineScales = Object.keys(TIMELINE_SCALES) as TimelineScale[];

export function isTimelineScale(value: string): value is TimelineScale {
  return value in TIMELINE_SCALES;
}

export function isPlaybackSpeed(value: number, scale: TimelineScale = 'shaking'): boolean {
  return (TIMELINE_SCALES[scale].speeds as readonly number[]).includes(value);
}

/** The single simulation clock (memory-bank/systemPatterns.md, "Single clock"). */
interface PlaybackState {
  /** Seconds after the origin time. */
  timeS: number;
  /** End of the active scale, s; 0 when nothing is loaded. */
  durationS: number;
  scale: TimelineScale;
  /** End of each scale, s; 0 while a scale is unavailable (the tsunami still computing). */
  extents: Record<TimelineScale, number>;
  playing: boolean;
  speed: number;
  /** Rewinds to the origin for a new scenario of the given shaking duration and plays it. */
  load: (durationS: number) => void;
  /** Makes a scale available (or unavailable with 0). */
  setExtent: (scale: TimelineScale, durationS: number) => void;
  /** Switches to an available scale, keeping the clock within it. */
  setScale: (scale: TimelineScale) => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (timeS: number) => void;
  setSpeed: (speed: number) => void;
  /** Moves the clock by `elapsedS` of wall time, scaled by the speed; stops at the end. */
  advance: (elapsedS: number) => void;
}

const clamp = (value: number, max: number) => Math.min(max, Math.max(0, value));

export const usePlaybackStore = create<PlaybackState>()((set) => ({
  timeS: 0,
  durationS: 0,
  scale: 'shaking',
  extents: { shaking: 0, tsunami: 0 },
  playing: false,
  speed: TIMELINE_SCALES.shaking.defaultSpeed,
  load: (durationS) => {
    set({
      timeS: 0,
      durationS,
      scale: 'shaking',
      extents: { shaking: durationS, tsunami: 0 },
      playing: true,
      speed: TIMELINE_SCALES.shaking.defaultSpeed,
    });
  },
  setExtent: (scale, durationS) => {
    set((state) => {
      const extents = { ...state.extents, [scale]: durationS };
      if (state.scale !== scale) return { extents };
      if (durationS > 0) return { extents, durationS, timeS: clamp(state.timeS, durationS) };
      // The active scale went away: fall back to the shaking.
      return {
        extents,
        scale: 'shaking' as const,
        durationS: extents.shaking,
        timeS: clamp(state.timeS, extents.shaking),
        speed: TIMELINE_SCALES.shaking.defaultSpeed,
      };
    });
  },
  setScale: (scale) => {
    set((state) => {
      const durationS = state.extents[scale];
      if (durationS <= 0 || scale === state.scale) return state;
      return {
        scale,
        durationS,
        timeS: clamp(state.timeS, durationS),
        speed: TIMELINE_SCALES[scale].defaultSpeed,
      };
    });
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
    set((state) => (isPlaybackSpeed(speed, state.scale) ? { speed } : state));
  },
  advance: (elapsedS) => {
    set((state) => {
      if (!state.playing) return state;
      const timeS = clamp(state.timeS + elapsedS * state.speed, state.durationS);
      return { timeS, playing: timeS < state.durationS };
    });
  },
}));
