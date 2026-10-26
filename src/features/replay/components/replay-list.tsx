import { History, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import type { ScenarioEvent } from '@/types/scenario';

import { HISTORICAL_EVENTS } from '../lib/historical-events';

interface ReplayListProps {
  activeId: string | null;
  computing: boolean;
  disabled: boolean;
  onRun: (event: ScenarioEvent) => void;
}

/** Historical earthquakes that can be replayed with their catalog parameters. */
export function ReplayList({ activeId, computing, disabled, onRun }: ReplayListProps) {
  const { t, i18n } = useTranslation();
  const date = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'medium',
    timeStyle: 'medium',
    timeZone: 'UTC',
  });

  return (
    <ul className="space-y-2">
      {HISTORICAL_EVENTS.map((event) => {
        const active = activeId === event.id;
        const Icon = computing && active ? Loader2 : History;
        return (
          <li key={event.id}>
            <button
              type="button"
              disabled={disabled}
              aria-current={active ? 'true' : undefined}
              onClick={() => {
                onRun(event);
              }}
              className={cn(
                'group flex w-full items-start gap-3 rounded-panel border border-line bg-surface-1 p-3 text-left transition-colors duration-150 hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-60',
                active && 'border-signal bg-surface-2',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'mt-0.5 grid size-7 shrink-0 place-items-center rounded-control border border-line bg-surface-2 text-fg-secondary group-hover:text-fg',
                  active && 'border-signal text-signal',
                )}
              >
                <Icon className={cn('size-3.5', computing && active && 'animate-spin')} />
              </span>
              <span className="min-w-0 space-y-1">
                <span className="block text-body font-medium text-fg">
                  {t(`replay.events.${event.id}`)}
                </span>
                <span className="block num text-caption text-fg-secondary">
                  {`Mw ${formatNumber(event.magnitude, i18n.language, 1)} · ${formatNumber(event.depthKm, i18n.language)} km · ${date.format(event.originMs)} UTC`}
                </span>
                <span className="block text-micro text-fg-muted">
                  {t('replay.source', { catalog: event.catalog })}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
