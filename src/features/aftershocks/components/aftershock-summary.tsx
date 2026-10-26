import { Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { formatClock, formatNumber, formatPercent } from '@/lib/format';
import { usePlaybackStore } from '@/state/playback-store';
import type { AftershockCatalog } from '@/types/aftershocks';

import { sequenceState } from '../lib/sequence-state';

/** The aftershock sequence so far and the model's 24-hour probabilities. */
export function AftershockSummary({ catalog }: { catalog: AftershockCatalog }) {
  const { t, i18n } = useTranslation();
  // Aftershocks are sparse in seconds; the summary refreshes once per simulated second.
  const second = usePlaybackStore((state) => Math.floor(state.timeS));
  const scale = usePlaybackStore((state) => state.scale);
  const setScale = usePlaybackStore((state) => state.setScale);
  const state = sequenceState(catalog, second);
  const largestMagnitude = catalog.magnitude[state.largest];
  const largestTime = catalog.timeS[state.largest];

  const rows: [string, string][] = [
    [t('aftershocks.count'), formatNumber(state.count, i18n.language)],
    [
      t('aftershocks.largest'),
      largestMagnitude === undefined || largestTime === undefined
        ? '—'
        : t('aftershocks.largestValue', {
            magnitude: formatNumber(largestMagnitude, i18n.language, 1),
            time: `T+ ${formatClock(largestTime)}`,
          }),
    ],
    [t('aftershocks.forecastM5'), formatPercent(state.forecastM5, i18n.language)],
    [t('aftershocks.forecastM6'), formatPercent(state.forecastM6, i18n.language)],
  ];

  return (
    <section
      aria-labelledby="aftershocks-title"
      data-testid="aftershock-summary"
      className="space-y-2"
    >
      <h3 id="aftershocks-title" className="label-micro">
        {t('aftershocks.title')}
      </h3>
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-line bg-line">
        {rows.map(([label, value]) => (
          <div key={label} className="bg-surface-1 px-3 py-2">
            <dt className="text-micro text-fg-muted">{label}</dt>
            <dd className="num text-caption text-fg">{value}</dd>
          </div>
        ))}
      </dl>
      {scale !== 'response' && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setScale('response');
          }}
        >
          <Clock />
          {t('aftershocks.openScale')}
        </Button>
      )}
      <p className="text-micro text-fg-muted">{t('aftershocks.note')}</p>
    </section>
  );
}
