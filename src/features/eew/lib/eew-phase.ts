import type { EarlyWarning } from '@/types/simulation';

export type EewPhase = 'idle' | 'detected' | 'alert';

/** What the early-warning system knows at `timeS`. */
export function eewPhase(warning: EarlyWarning | null | undefined, timeS: number): EewPhase {
  if (!warning || timeS < warning.firstTriggerS) return 'idle';
  return timeS < warning.alertS ? 'detected' : 'alert';
}
