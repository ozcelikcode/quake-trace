import { FileText, Map as MapIcon, ScrollText, Table } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { downloadText } from '@/lib/download';
import { usePlaybackStore } from '@/state/playback-store';

import { useEventLog } from '../hooks/use-event-log';
import { districtRows, toCsv, toGeoJson } from '../lib/district-export';
import { EventLogList } from './event-log-list';

/** Number of entries at or before `timeS` (entries are sorted by time). */
function passedCount(times: readonly number[], timeS: number): number {
  let low = 0;
  let high = times.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if ((times[middle] ?? 0) <= timeS) low = middle + 1;
    else high = middle;
  }
  return low;
}

/** The scenario's event log, revealed with the clock, and its exports. */
export function EventsPanel() {
  const { t } = useTranslation();
  const { result, tsunami, districts, entries } = useEventLog();
  const times = useMemo(() => entries.map((entry) => entry.timeS), [entries]);
  // Re-render only when an entry is passed, not on every frame.
  const passed = usePlaybackStore((state) => passedCount(times, state.timeS));

  if (!result || !districts) {
    return (
      <EmptyState
        icon={ScrollText}
        title={t('panels.events.emptyTitle')}
        description={t('panels.events.emptyBody')}
      />
    );
  }

  const fileBase = `quaketrace-simulation-${result.scenarioId}`;
  const exportMeta = () => ({
    scenarioId: result.scenarioId,
    url: window.location.href,
    generatedAt: new Date().toISOString(),
    disclaimer: t('events.export.disclaimer'),
  });

  return (
    <div className="flex flex-col gap-4 p-3">
      <section aria-labelledby="events-export-title" className="space-y-2">
        <h3 id="events-export-title" className="label-micro">
          {t('events.export.title')}
        </h3>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => {
              // The report is always in the page while a scenario is loaded (ScenarioReport).
              window.print();
            }}
          >
            <FileText />
            {t('events.export.report')}
          </Button>
          <Button
            size="sm"
            onClick={() => {
              const rows = districtRows(result, tsunami, districts);
              const geojson = toGeoJson(result, rows, districts, exportMeta());
              downloadText(`${fileBase}.geojson`, JSON.stringify(geojson), 'application/geo+json');
            }}
          >
            <MapIcon />
            {t('events.export.geojson')}
          </Button>
          <Button
            size="sm"
            onClick={() => {
              const rows = districtRows(result, tsunami, districts);
              downloadText(`${fileBase}-districts.csv`, toCsv(rows), 'text/csv;charset=utf-8');
            }}
          >
            <Table />
            {t('events.export.csv')}
          </Button>
        </div>
        <p className="text-micro text-fg-muted">{t('events.export.note')}</p>
      </section>

      <EventLogList entries={entries} passed={passed} />
    </div>
  );
}
