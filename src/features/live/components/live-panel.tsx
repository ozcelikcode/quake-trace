import { Loader2, Play, Radio } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import { useLiveStore } from '@/state/live-store';
import type { ScenarioEvent } from '@/types/scenario';

import { useLiveFeeds } from '../hooks/use-live-feeds';
import { MIN_SCENARIO_MAGNITUDE, SOURCE_LABELS, toScenarioEvent } from '../lib/scenario-event';

interface LivePanelProps {
  /** A scenario id when the one running came from a live event. */
  activeId: string | null;
  computing: boolean;
  disabled: boolean;
  onRun: (event: ScenarioEvent) => void;
}

const LISTED = 40;
const STATUS_DOT = { pending: 'bg-fg-muted', error: 'bg-critical', success: 'bg-ok' } as const;

/** Recent earthquakes in the region from AFAD, Kandilli, EMSC and USGS, polled every minute. */
export function LivePanel({ activeId, computing, disabled, onRun }: LivePanelProps) {
  const { t, i18n } = useTranslation();
  const { events, feeds } = useLiveFeeds(true);
  const selectedId = useLiveStore((state) => state.selectedId);
  const select = useLiveStore((state) => state.select);
  const time = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'short',
    timeStyle: 'medium',
    timeZone: 'UTC',
  });

  return (
    <div className="space-y-3">
      <ul aria-label={t('live.feeds')} className="flex flex-wrap gap-x-3 gap-y-1">
        {feeds.map((feed) => (
          <li key={feed.source} className="flex items-center gap-1.5 text-micro text-fg-muted">
            <span aria-hidden className={cn('size-1.5 rounded-full', STATUS_DOT[feed.status])} />
            {SOURCE_LABELS[feed.source]}
            <span className="sr-only">{t(`live.status.${feed.status}`)}</span>
            {feed.status === 'success' && (
              <span className="num">{formatNumber(feed.count, i18n.language)}</span>
            )}
          </li>
        ))}
      </ul>

      {events.length === 0 ? (
        <p className="text-caption text-fg-muted">
          {feeds.some((feed) => feed.status === 'pending') ? t('live.loading') : t('live.empty')}
        </p>
      ) : (
        <ul
          className="divide-y divide-line rounded-panel border border-line"
          data-testid="live-events"
        >
          {events.slice(0, LISTED).map((event) => {
            const selected = selectedId === event.id;
            const scenarioId = `event:${event.id}`;
            const runnable = event.magnitude >= MIN_SCENARIO_MAGNITUDE;
            return (
              <li key={event.id} className={cn(selected && 'bg-surface-2')}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    select(selected ? null : event.id);
                  }}
                  className="grid w-full grid-cols-[3rem_minmax(0,1fr)] items-baseline gap-2 px-3 py-2 text-left hover:bg-surface-3 focus-visible:-outline-offset-2"
                >
                  <span className="num text-body font-medium text-fg">
                    {formatNumber(event.magnitude, i18n.language, 1)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-caption text-fg">{event.place}</span>
                    <span className="block num text-micro text-fg-muted">
                      {`${time.format(event.timeMs)} UTC · ${formatNumber(event.depthKm, i18n.language)} km · ${event.reports.map((r) => SOURCE_LABELS[r.source]).join(', ')}`}
                    </span>
                  </span>
                </button>
                {selected && (
                  <div className="flex items-center justify-between gap-2 px-3 pb-2">
                    <span className="text-micro text-fg-muted">
                      {runnable
                        ? t('live.simulateHint')
                        : t('live.tooSmall', {
                            magnitude: formatNumber(MIN_SCENARIO_MAGNITUDE, i18n.language, 1),
                          })}
                    </span>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!runnable || disabled}
                      onClick={() => {
                        onRun(toScenarioEvent(event));
                      }}
                    >
                      {computing && activeId === scenarioId ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Play />
                      )}
                      {t('live.simulate')}
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="flex items-start gap-1.5 text-micro text-fg-muted">
        <Radio aria-hidden className="mt-0.5 size-3 shrink-0" />
        {t('live.note')}
      </p>
    </div>
  );
}
