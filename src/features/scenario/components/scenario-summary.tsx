import { useTranslation } from 'react-i18next';

import { formatNumber } from '@/lib/format';
import { useObservedStore } from '@/state/observed-store';
import { useScenarioStore } from '@/state/scenario-store';
import type { SimulationResult } from '@/types/simulation';

import { ShareLinkButton } from './share-link-button';

export function ScenarioSummary({ result }: { result: SimulationResult }) {
  const { t, i18n } = useTranslation();
  const number = (value: number, digits = 0) => formatNumber(value, i18n.language, digits);
  const { rupture } = result;
  const origin = useScenarioStore((state) => state.origin);
  const observedStatus = useObservedStore((state) =>
    state.scenarioId === result.scenarioId ? state.status : 'idle',
  );
  const observedCount = useObservedStore((state) => Object.keys(state.records).length);
  const time = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'medium',
    timeStyle: 'medium',
    timeZone: 'UTC',
  });

  const rows: [string, string][] = [
    [t('scenario.summary.magnitude'), `Mw ${number(rupture.mw, 1)}`],
    [t('scenario.summary.length'), `${number(rupture.lengthKm)} km`],
    [t('scenario.summary.width'), `${number(rupture.widthKm)} km`],
    [t('scenario.summary.depth'), `${number(rupture.hypocenter.depthKm)} km`],
    [t('scenario.summary.ruptureDuration'), `${number(rupture.ruptureDurationS, 1)} s`],
    [t('scenario.summary.computeTime'), `${number(result.computeMs)} ms`],
  ];
  const customRows: [string, string][] =
    origin?.kind === 'custom'
      ? [
          [t('scenario.summary.customFault'), origin.faultId],
          [t('scenario.summary.seed'), String(origin.seed)],
        ]
      : [];
  const eventRows: [string, string][] =
    origin && (origin.kind === 'replay' || origin.kind === 'event')
      ? [
          [
            t('scenario.summary.origin'),
            `${t('scenario.summary.originValue', {
              magnitude: number(origin.magnitude, 1),
              time: time.format(origin.originMs),
            })} · ${origin.catalog}`,
          ],
          [
            t('scenario.summary.fault'),
            t('scenario.summary.faultValue', {
              fault: origin.faultId,
              distance: number(origin.faultDistanceKm, 1),
            }),
          ],
          [
            t('scenario.summary.observed'),
            t(`scenario.summary.observedStatus.${observedStatus}`, { count: observedCount }),
          ],
        ]
      : [];
  const sourceRows = [...customRows, ...eventRows];

  return (
    <section aria-labelledby="scenario-summary-title" className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 id="scenario-summary-title" className="label-micro">
          {t('scenario.summary.title')}
        </h3>
        <ShareLinkButton />
      </div>
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-line bg-line">
        {rows.map(([label, value]) => (
          <div key={label} className="bg-surface-1 px-3 py-2">
            <dt className="text-micro text-fg-muted">{label}</dt>
            <dd className="num text-body text-fg">{value}</dd>
          </div>
        ))}
      </dl>
      {sourceRows.length > 0 && (
        <dl className="space-y-1 text-caption" data-testid="scenario-origin">
          {sourceRows.map(([label, value]) => (
            <div key={label} className="grid grid-cols-[7rem_minmax(0,1fr)] gap-2">
              <dt className="text-fg-muted">{label}</dt>
              <dd className="text-fg">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
