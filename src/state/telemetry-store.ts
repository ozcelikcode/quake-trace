import { create } from 'zustand';

import type { StationRecords } from '@/types/simulation';

interface TelemetryState {
  /** Station shown in the telemetry focus view; null follows the first triggered station. */
  focusedStationId: string | null;
  focusStation: (id: string | null) => void;
}

export const useTelemetryStore = create<TelemetryState>()((set) => ({
  focusedStationId: null,
  focusStation: (focusedStationId) => {
    set({ focusedStationId });
  },
}));

/**
 * Index of the focused station's record: the chosen station, or the first to trigger (then the
 * first P arrival) when nothing is chosen or the choice has no record in this scenario.
 */
export function resolveFocusedStation(records: StationRecords, focusedId: string | null): number {
  const chosen = records.stations.findIndex((station) => station.id === focusedId);
  if (chosen >= 0) return chosen;
  let best = -1;
  records.stations.forEach((station, index) => {
    const current = records.stations[best];
    const trigger = station.triggerS ?? Number.POSITIVE_INFINITY;
    const bestTrigger = current?.triggerS ?? Number.POSITIVE_INFINITY;
    if (
      !current ||
      trigger < bestTrigger ||
      (trigger === bestTrigger && station.pArrivalS < current.pArrivalS)
    ) {
      best = index;
    }
  });
  return best;
}
