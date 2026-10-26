import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/cn';
import { formatClock } from '@/lib/format';
import { usePlaybackStore } from '@/state/playback-store';

import { entryText } from '../lib/entry-text';
import type { LogEntry, LogTone } from '../lib/event-log';

const TONE_DOT: Record<LogTone, string> = {
  neutral: 'bg-fg-muted',
  info: 'bg-info',
  warning: 'bg-warning',
  critical: 'bg-critical',
};

interface EventLogListProps {
  entries: readonly LogEntry[];
  /** Entries at or before the clock; they are listed newest first. */
  passed: number;
}

/** Log entries that have happened, newest first; choosing one moves the clock to it. */
export function EventLogList({ entries, passed }: EventLogListProps) {
  const { t, i18n } = useTranslation();
  const reveal = usePlaybackStore((state) => state.reveal);
  const shown = entries.slice(0, passed).reverse();
  const upcoming = entries.length - passed;

  return (
    <section aria-labelledby="events-log-title" className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h3 id="events-log-title" className="label-micro">
          {t('events.title')}
        </h3>
        <span className="num text-micro text-fg-muted">
          {t('events.count', { count: passed, total: entries.length })}
        </span>
      </div>
      <ol
        aria-live="polite"
        aria-relevant="additions"
        className="space-y-px"
        data-testid="event-log"
      >
        {shown.map((entry) => (
          <li key={entry.id}>
            <button
              type="button"
              onClick={() => {
                reveal(entry.timeS);
              }}
              className="grid w-full grid-cols-[4.5rem_0.5rem_minmax(0,1fr)] items-baseline gap-2 rounded-control px-1.5 py-1.5 text-left transition-colors duration-150 hover:bg-surface-3 pointer-coarse:py-2.5"
            >
              <span className="num text-micro text-fg-muted">{formatClock(entry.timeS)}</span>
              <span
                aria-hidden
                className={cn('size-1.5 self-center rounded-full', TONE_DOT[entry.tone])}
              />
              <span
                className={cn(
                  'text-caption',
                  entry.tone === 'critical' ? 'font-medium text-fg' : 'text-fg-secondary',
                )}
              >
                {entryText(t, i18n.language, entry)}
              </span>
            </button>
          </li>
        ))}
      </ol>
      {upcoming > 0 && (
        <p className="text-micro text-fg-muted">{t('events.upcoming', { count: upcoming })}</p>
      )}
    </section>
  );
}
