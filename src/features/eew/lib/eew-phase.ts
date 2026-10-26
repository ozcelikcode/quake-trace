import type { EarlyWarning } from '@/types/simulation';

export type EewPhase = 'idle' | 'detected' | 'alert';

/**
 * What the early-warning system knows at `timeS`. An alert concerns the coming shaking, so with
 * `shakingEndS` it is over (idle) once the shaking has ended; hours later, on the response scale,
 * the status bar no longer shows it.
 */
export function eewPhase(
  warning: EarlyWarning | null | undefined,
  timeS: number,
  shakingEndS = Number.POSITIVE_INFINITY,
): EewPhase {
  if (!warning || timeS < warning.firstTriggerS || timeS > shakingEndS) return 'idle';
  return timeS < warning.alertS ? 'detected' : 'alert';
}
