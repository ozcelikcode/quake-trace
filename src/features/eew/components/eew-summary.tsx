import { useTranslation } from 'react-i18next';

import { formatNumber } from '@/lib/format';
import { usePlaybackStore } from '@/state/playback-store';
import type { SimulationResult } from '@/types/simulation';

import { eewPhase } from '../lib/eew-phase';

/** Alert time, first estimates against the scenario's truth, and how many districts were warned. */
export function EewSummary({ result }: { result: SimulationResult }) {
  const { t, i18n } = useTranslation();
  const warning = result.earlyWarning;
  const alerted = usePlaybackStore((state) => eewPhase(warning, state.timeS) === 'alert');
  const number = (value: number, digits = 0) => formatNumber(value, i18n.language, digits);

  if (!warning) {
    return <p className="text-caption text-fg-muted">{t('eew.unavailable')}</p>;
  }

  const blind = result.districts.filter((district) => district.sArrivalS <= warning.alertS).length;
  const rows: [string, string][] = alerted
    ? [
        [t('eew.alertTime'), `T+${number(warning.alertS, 1)} s`],
        [
          t('eew.magnitude'),
          t('eew.magnitudeValue', {
            estimate: number(warning.magnitude, 1),
            actual: number(result.rupture.mw, 1),
          }),
        ],
        [t('eew.locationError'), `${number(warning.locationErrorKm, 1)} km`],
        [t('eew.warned'), `${number(result.districts.length - blind)} / ${number(blind)}`],
      ]
    : [];

  return (
    <section aria-labelledby="eew-summary-title" data-testid="eew-summary" className="space-y-2">
      <h3 id="eew-summary-title" className="label-micro">
        {t('eew.title')}
      </h3>
      {alerted ? (
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-line bg-line">
          {rows.map(([label, value]) => (
            <div key={label} className="bg-surface-1 px-3 py-2">
              <dt className="text-micro text-fg-muted">{label}</dt>
              <dd className="num text-body text-fg">{value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="rounded-panel border border-dashed border-line px-3 py-2 text-caption text-fg-muted">
          {t('eew.waiting')}
        </p>
      )}
      <p className="text-micro text-fg-muted">{t('eew.note')}</p>
    </section>
  );
}
