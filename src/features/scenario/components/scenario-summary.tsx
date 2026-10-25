import { useTranslation } from 'react-i18next';

import { formatNumber } from '@/lib/format';
import type { SimulationResult } from '@/types/simulation';

export function ScenarioSummary({ result }: { result: SimulationResult }) {
  const { t, i18n } = useTranslation();
  const number = (value: number, digits = 0) => formatNumber(value, i18n.language, digits);
  const { rupture } = result;

  const rows: [string, string][] = [
    [t('scenario.summary.magnitude'), `Mw ${number(rupture.mw, 1)}`],
    [t('scenario.summary.length'), `${number(rupture.lengthKm)} km`],
    [t('scenario.summary.width'), `${number(rupture.widthKm)} km`],
    [t('scenario.summary.depth'), `${number(rupture.hypocenter.depthKm)} km`],
    [t('scenario.summary.ruptureDuration'), `${number(rupture.ruptureDurationS, 1)} s`],
    [t('scenario.summary.computeTime'), `${number(result.computeMs)} ms`],
  ];

  return (
    <section aria-labelledby="scenario-summary-title" className="space-y-2">
      <h3 id="scenario-summary-title" className="label-micro">
        {t('scenario.summary.title')}
      </h3>
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-line bg-line">
        {rows.map(([label, value]) => (
          <div key={label} className="bg-surface-1 px-3 py-2">
            <dt className="text-micro text-fg-muted">{label}</dt>
            <dd className="num text-body text-fg">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
