import { Waves } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { useJsonDataset } from '@/data/use-dataset';
import { formatNumber } from '@/lib/format';
import { usePlaybackStore } from '@/state/playback-store';
import { useTsunamiStore } from '@/state/tsunami-store';

import { coastReached, highestCoast } from '../lib/coast-reached';

/** Coastal districts listed at most; the rest are counted. */
const LISTED = 6;

/** The scenario's tsunami: computing state, source, and coastal arrivals as the clock passes. */
export function TsunamiSummary() {
  const { t, i18n } = useTranslation();
  const status = useTsunamiStore((state) => state.status);
  const result = useTsunamiStore((state) => state.result);
  const districts = useJsonDataset('districts').data;
  const second = usePlaybackStore((state) => Math.floor(state.timeS));
  const scale = usePlaybackStore((state) => state.scale);
  const setScale = usePlaybackStore((state) => state.setScale);
  // Opening the summary is asking for the tsunami.
  useEffect(() => {
    if (status === 'pending') useTsunamiStore.getState().request();
  }, [status]);
  if (status === 'idle') return null;

  const number = (value: number, digits = 0) => formatNumber(value, i18n.language, digits);
  const name = (index: number) => districts?.features[index]?.properties.name ?? '—';
  const header = (
    <h3 id="tsunami-title" className="label-micro">
      {t('tsunami.title')}
    </h3>
  );

  if (!result) {
    return (
      <section aria-labelledby="tsunami-title" data-testid="tsunami-summary" className="space-y-2">
        {header}
        <p
          className={
            status === 'error' ? 'text-caption text-critical' : 'text-caption text-fg-muted'
          }
          aria-live="polite"
        >
          {status === 'error' ? t('tsunami.error') : t('tsunami.computing')}
        </p>
      </section>
    );
  }

  const reached = coastReached(result.coast, second);
  const first = coastReached(result.coast, Number.POSITIVE_INFINITY)[0];
  const highest = highestCoast(result.coast);
  const rows: [string, string][] = [
    [t('tsunami.slip'), t('tsunami.metres', { value: number(result.source.slipM, 1) })],
    [
      t('tsunami.seafloor'),
      `+${number(result.source.maxUpliftM, 2)} / ${number(result.source.minUpliftM, 2)} m`,
    ],
    [
      t('tsunami.firstArrival'),
      first
        ? t('tsunami.minutesAt', {
            value: number(first.arrivalS / 60, 1),
            district: name(first.index),
          })
        : '—',
    ],
    [
      t('tsunami.highest'),
      highest
        ? t('tsunami.metresAt', {
            value: number(highest.maxEtaM, 1),
            district: name(highest.index),
          })
        : '—',
    ],
  ];

  return (
    <section aria-labelledby="tsunami-title" data-testid="tsunami-summary" className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        {header}
        <span className="num text-micro text-fg-muted">
          {t('tsunami.reached', { count: reached.length, total: result.coast.length })}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-line bg-line">
        {rows.map(([label, value]) => (
          <div key={label} className="bg-surface-1 px-3 py-2">
            <dt className="text-micro text-fg-muted">{label}</dt>
            <dd className="num text-caption text-fg">{value}</dd>
          </div>
        ))}
      </dl>
      {reached.length > 0 && (
        <ul className="space-y-0.5">
          {reached.slice(0, LISTED).map((entry) => (
            <li
              key={entry.index}
              className="flex items-baseline justify-between gap-2 text-caption"
            >
              <span className="truncate text-fg">{name(entry.index)}</span>
              <span className="num whitespace-nowrap text-fg-secondary">
                {t('tsunami.row', {
                  arrival: number(entry.arrivalS / 60, 1),
                  height: number(entry.maxEtaM, 1),
                })}
              </span>
            </li>
          ))}
        </ul>
      )}
      {scale !== 'tsunami' && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setScale('tsunami');
          }}
        >
          <Waves />
          {t('tsunami.openScale')}
        </Button>
      )}
      <p className="text-micro text-fg-muted">{t('tsunami.note')}</p>
    </section>
  );
}
