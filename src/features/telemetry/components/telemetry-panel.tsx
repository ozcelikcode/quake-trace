import { AudioWaveform } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/ui/empty-state';
import { usePlaybackStore } from '@/state/playback-store';
import { useScenarioStore } from '@/state/scenario-store';
import { resolveFocusedStation, useTelemetryStore } from '@/state/telemetry-store';
import type { StationRecords } from '@/types/simulation';

import { triggeredCount, triggerOrder } from '../lib/records';
import { FocusedStation } from './focused-station';
import { StationList } from './station-list';

export function TelemetryPanel() {
  const { t } = useTranslation();
  const result = useScenarioStore((state) => state.result);

  if (!result || result.records.stations.length === 0) {
    return (
      <EmptyState
        icon={AudioWaveform}
        title={t('panels.telemetry.emptyTitle')}
        description={t('panels.telemetry.emptyBody')}
      />
    );
  }
  return <TelemetryView records={result.records} durationS={result.durationS} />;
}

function TelemetryView({ records, durationS }: { records: StationRecords; durationS: number }) {
  const order = useMemo(() => triggerOrder(records), [records]);
  const focusedId = useTelemetryStore((state) => state.focusedStationId);
  const focusStation = useTelemetryStore((state) => state.focusStation);
  // Re-render on the number of triggered stations, not on every clock tick.
  const triggered = usePlaybackStore((state) => triggeredCount(records, order, state.timeS));
  const focusedIndex = resolveFocusedStation(records, focusedId);

  return (
    <div className="flex flex-col">
      <FocusedStation records={records} index={focusedIndex} durationS={durationS} />
      <StationList
        records={records}
        order={order}
        triggeredCount={triggered}
        focusedIndex={focusedIndex}
        durationS={durationS}
        onFocus={focusStation}
      />
    </div>
  );
}
