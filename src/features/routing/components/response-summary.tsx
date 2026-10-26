import { useTranslation } from 'react-i18next';

import { useJsonDataset, useRoadGraph } from '@/data/use-dataset';
import { formatNumber } from '@/lib/format';
import { usePlaybackStore } from '@/state/playback-store';
import type { RoutingResult } from '@/types/routing';

import { responseStats } from '../lib/response-stats';

interface ResponseSummaryProps {
  routing: RoutingResult;
  /** Indices of the districts the S wave has reached. */
  reached: ReadonlySet<number>;
}

/** Fire response times before and after the shaking, impaired roads and cut-off districts. */
export function ResponseSummary({ routing, reached }: ResponseSummaryProps) {
  const { t, i18n } = useTranslation();
  const graph = useRoadGraph().data;
  const districts = useJsonDataset('districts').data;
  // Impairments appear as the S wave reaches each road; a second is fine enough here.
  const second = usePlaybackStore((state) => Math.floor(state.timeS));
  const stats = responseStats(routing, reached, second, graph);
  const number = (value: number, digits = 0) =>
    Number.isFinite(value) ? formatNumber(value, i18n.language, digits) : '—';
  const minutes = (value: number) => t('routing.minutes', { value: number(value, 1) });

  const rows: [string, string][] = [
    [t('routing.medianBefore'), minutes(stats.medianBeforeMin)],
    [t('routing.medianAfter'), minutes(stats.medianAfterMin)],
    [t('routing.debris'), t('routing.km', { value: number(stats.debrisKm) })],
    [t('routing.bridges'), number(stats.bridgesClosed)],
  ];
  const worstName = stats.worst && districts?.features[stats.worst.index]?.properties.name;

  return (
    <section aria-labelledby="routing-title" data-testid="response-summary" className="space-y-2">
      <h3 id="routing-title" className="label-micro">
        {t('routing.title')}
      </h3>
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-line bg-line">
        {rows.map(([label, value]) => (
          <div key={label} className="bg-surface-1 px-3 py-2">
            <dt className="text-micro text-fg-muted">{label}</dt>
            <dd className="num text-body text-fg">{value}</dd>
          </div>
        ))}
      </dl>
      {stats.worst && worstName && (
        <p className="text-caption text-fg-secondary">
          {t('routing.worst', {
            district: worstName,
            increase: number(stats.worst.increaseMin, 1),
          })}
        </p>
      )}
      {stats.cutOff > 0 && (
        <p className="text-caption text-critical">{t('routing.cutOff', { count: stats.cutOff })}</p>
      )}
      <p className="text-micro text-fg-muted">{t('routing.note')}</p>
    </section>
  );
}
