import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import type { Districts } from '@/data/schemas';
import { summarizeNetwork } from '@/features/cells';
import { responseStats } from '@/features/routing';
import { mmiRoman } from '@/lib/color/mmi';
import { formatClock, formatNumber, formatPercent, roundSignificant } from '@/lib/format';
import { useScenarioStore } from '@/state/scenario-store';
import { useTsunamiStore } from '@/state/tsunami-store';
import { CRITICAL_FACILITY_KINDS, FACILITY_OUT_OF_SERVICE_FROM } from '@/types/damage';
import type { RoadGraph } from '@/types/roads';
import type { SimulationResult } from '@/types/simulation';
import type { TsunamiResult } from '@/types/tsunami';

import { useEventLog } from '../hooks/use-event-log';
import { entryText } from '../lib/entry-text';
import type { LogEntry } from '../lib/event-log';

/** Districts listed in the report, strongest shaking first. */
const REPORT_DISTRICTS = 30;

interface ReportDocumentProps {
  result: SimulationResult;
  tsunami: TsunamiResult | null;
  districts: Districts;
  roads: RoadGraph | undefined;
  entries: readonly LogEntry[];
}

/** When and from which link the report is printed, refreshed as the print dialog opens. */
function usePrintStamp() {
  const [stamp, setStamp] = useState(() => ({ at: new Date(), url: window.location.href }));
  useEffect(() => {
    const update = () => {
      setStamp({ at: new Date(), url: window.location.href });
    };
    window.addEventListener('beforeprint', update);
    return () => {
      window.removeEventListener('beforeprint', update);
    };
  }, []);
  return stamp;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="break-inside-avoid space-y-2">
      <h2 className="border-b border-line-strong pb-1 text-title font-semibold text-fg">{title}</h2>
      {children}
    </section>
  );
}

function Readouts({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid grid-cols-3 gap-x-6 gap-y-2">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="text-micro text-fg-muted">{label}</dt>
          <dd className="num text-body text-fg">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The printable report of the loaded scenario. It sits in the page, hidden on screen, whenever a
 * scenario is loaded; the print stylesheet shows it instead of the app, so the report button and
 * the browser's own print command both produce it, and the print dialog saves it as PDF.
 */
export function ScenarioReport() {
  const { result, tsunami, districts, roads, entries } = useEventLog();
  if (!result || !districts) return null;
  return (
    <ReportDocument
      result={result}
      tsunami={tsunami}
      districts={districts}
      roads={roads}
      entries={entries}
    />
  );
}

/** Values are the scenario's final state (end of each timeline scale), not the playback moment. */
function ReportDocument({ result, tsunami, districts, roads, entries }: ReportDocumentProps) {
  const { t, i18n } = useTranslation();
  const origin = useScenarioStore((state) => state.origin);
  const tsunamiStatus = useTsunamiStore((state) => state.status);
  const stamp = usePrintStamp();

  const language = i18n.language;
  const number = (value: number, digits = 0) => formatNumber(value, language, digits);
  const clock = (seconds: number) => `T+ ${formatClock(seconds)}`;
  const { rupture, earlyWarning, damage, network, routing, aftershocks } = result;
  const name = (index: number) => districts.features[index]?.properties;

  const source =
    origin?.kind === 'custom'
      ? t('report.custom', { fault: origin.faultId, seed: origin.seed })
      : origin?.kind === 'replay' || origin?.kind === 'event'
        ? `${origin.place} · ${origin.catalog}`
        : t(`scenario.presets.${result.scenarioId}.name`, { defaultValue: result.scenarioId });

  const scenarioRows: [string, string][] = [
    [t('scenario.summary.magnitude'), `Mw ${number(rupture.mw, 1)}`],
    [t('scenario.summary.length'), `${number(rupture.lengthKm)} km`],
    [t('scenario.summary.width'), `${number(rupture.widthKm)} km`],
    [t('scenario.summary.depth'), `${number(rupture.hypocenter.depthKm)} km`],
    [
      t('report.hypocenter'),
      `${number(rupture.hypocenter.lat, 3)}° N ${number(rupture.hypocenter.lon, 3)}° E`,
    ],
    [t('scenario.summary.ruptureDuration'), `${number(rupture.ruptureDurationS, 1)} s`],
  ];

  const warningRows: [string, string][] = earlyWarning
    ? [
        [t('timeline.detection'), clock(earlyWarning.firstTriggerS)],
        [t('eew.alertTime'), clock(earlyWarning.alertS)],
        [t('eew.magnitude'), `M ${number(earlyWarning.magnitude, 1)}`],
        [t('eew.locationError'), `${number(earlyWarning.locationErrorKm, 1)} km`],
      ]
    : [];

  const damageRows: [string, string][] = damage
    ? [
        [
          t('damage.buildingsLost'),
          `≈ ${number(roundSignificant(damage.districts.reduce((sum, d) => sum + d.buildingsLost, 0)))}`,
        ],
        [
          t('damage.fatalities'),
          `≈ ${number(roundSignificant(damage.districts.reduce((sum, d) => sum + d.fatalities, 0)))}`,
        ],
        ...CRITICAL_FACILITY_KINDS.map((kind): [string, string] => [
          t(`report.facilitiesOut.${kind}`),
          number(
            damage.facilities.filter(
              (f) => f.kind === kind && f.lossRatio >= FACILITY_OUT_OF_SERVICE_FROM,
            ).length,
          ),
        ]),
      ]
    : [];

  const networkSummary = network && summarizeNetwork(network, result.durationS);
  const networkRows: [string, string][] = networkSummary
    ? [
        [t('network.state.congested'), number(networkSummary.sites.congested)],
        [t('network.state.down'), number(networkSummary.sites.down)],
        [t('network.blocked'), formatPercent(networkSummary.blockedShare, language)],
      ]
    : [];

  const reachedAll = new Set(result.districts.map((impact) => impact.index));
  const stats = routing && responseStats(routing, reachedAll, Number.POSITIVE_INFINITY, roads);
  const routingRows: [string, string][] = stats
    ? [
        [
          t('routing.medianBefore'),
          t('routing.minutes', { value: number(stats.medianBeforeMin, 1) }),
        ],
        [
          t('routing.medianAfter'),
          t('routing.minutes', { value: number(stats.medianAfterMin, 1) }),
        ],
        [t('routing.debris'), t('routing.km', { value: number(stats.debrisKm) })],
        [t('routing.bridges'), number(stats.bridgesClosed)],
        [t('report.cutOff'), number(stats.cutOff)],
      ]
    : [];

  const coasts = tsunami?.coast.filter((coast) => Number.isFinite(coast.arrivalS)) ?? [];
  const firstCoast = coasts.reduce<(typeof coasts)[number] | undefined>(
    (min, coast) => (!min || coast.arrivalS < min.arrivalS ? coast : min),
    undefined,
  );
  const highestCoast = coasts.reduce<(typeof coasts)[number] | undefined>(
    (max, coast) => (!max || coast.maxEtaM > max.maxEtaM ? coast : max),
    undefined,
  );
  const tsunamiRows: [string, string][] =
    tsunami && firstCoast && highestCoast
      ? [
          [
            t('tsunami.firstArrival'),
            t('tsunami.minutesAt', {
              value: number(firstCoast.arrivalS / 60, 1),
              district: name(firstCoast.index)?.name ?? '',
            }),
          ],
          [
            t('tsunami.highest'),
            t('tsunami.metresAt', {
              value: number(highestCoast.maxEtaM, 1),
              district: name(highestCoast.index)?.name ?? '',
            }),
          ],
          [t('tsunami.slip'), t('tsunami.metres', { value: number(tsunami.source.slipM, 1) })],
        ]
      : [];

  let largest = -1;
  aftershocks.magnitude.forEach((magnitude, i) => {
    if (largest < 0 || magnitude > (aftershocks.magnitude[largest] ?? 0)) largest = i;
  });
  const aftershockRows: [string, string][] = [
    [t('report.aftershockCount'), number(aftershocks.count)],
    [
      t('report.aftershockLargest'),
      largest < 0
        ? '—'
        : t('aftershocks.largestValue', {
            magnitude: number(aftershocks.magnitude[largest] ?? 0, 1),
            time: clock(aftershocks.timeS[largest] ?? 0),
          }),
    ],
    [
      t('report.aftershockM5'),
      number(Array.from(aftershocks.magnitude).filter((magnitude) => magnitude >= 5).length),
    ],
  ];

  const damageByIndex = new Map(damage?.districts.map((d) => [d.index, d]));
  const strongest = [...result.districts]
    .sort((a, b) => b.maxMmi - a.maxMmi)
    .slice(0, REPORT_DISTRICTS);
  const alertS = earlyWarning?.alertS;

  return createPortal(
    <article data-print-report lang={language} className="space-y-6 bg-surface-1 p-2 text-fg">
      <header className="space-y-1 border-b-2 border-fg pb-3">
        <p className="text-caption font-semibold text-critical">{t('report.simulation')}</p>
        <h1 className="text-hero font-semibold">{t('report.title')}</h1>
        <p className="text-title">{source}</p>
        <p className="num text-micro text-fg-muted">
          {t('report.generated', {
            time: new Intl.DateTimeFormat(language, {
              dateStyle: 'long',
              timeStyle: 'short',
            }).format(stamp.at),
          })}
        </p>
        <p className="num text-micro break-all text-fg-muted">{stamp.url}</p>
      </header>

      <Section title={t('report.sections.scenario')}>
        <Readouts rows={scenarioRows} />
      </Section>
      {warningRows.length > 0 && (
        <Section title={t('eew.title')}>
          <Readouts rows={warningRows} />
        </Section>
      )}
      {damageRows.length > 0 && (
        <Section title={t('damage.title')}>
          <Readouts rows={damageRows} />
          <p className="text-micro text-fg-muted">{t('damage.note')}</p>
        </Section>
      )}
      {networkRows.length > 0 && (
        <Section title={t('network.title')}>
          <Readouts rows={networkRows} />
        </Section>
      )}
      {routingRows.length > 0 && (
        <Section title={t('routing.title')}>
          <Readouts rows={routingRows} />
        </Section>
      )}
      {tsunamiRows.length > 0 ? (
        <Section title={t('tsunami.title')}>
          <Readouts rows={tsunamiRows} />
        </Section>
      ) : (
        tsunamiStatus === 'computing' && (
          <Section title={t('tsunami.title')}>
            <p className="text-caption text-fg-secondary">{t('tsunami.computing')}</p>
          </Section>
        )
      )}
      <Section title={t('aftershocks.title')}>
        <Readouts rows={aftershockRows} />
      </Section>

      <Section title={t('report.sections.districts', { count: strongest.length })}>
        <table className="w-full border-collapse text-left text-caption">
          <thead>
            <tr className="border-b border-line-strong text-micro text-fg-muted">
              <th scope="col" className="py-1 pr-2 font-medium">
                {t('impact.district')}
              </th>
              <th scope="col" className="py-1 pr-2 font-medium">
                {t('impact.sArrival')}
              </th>
              <th scope="col" className="py-1 pr-2 font-medium">
                {t('impact.intensity')}
              </th>
              <th scope="col" className="py-1 pr-2 font-medium">
                {t('impact.warning')}
              </th>
              <th scope="col" className="py-1 pr-2 font-medium">
                {t('damage.lossRatio')}
              </th>
              <th scope="col" className="py-1 font-medium">
                {t('damage.fatalities')}
              </th>
            </tr>
          </thead>
          <tbody>
            {strongest.map((impact) => {
              const properties = name(impact.index);
              const loss = damageByIndex.get(impact.index);
              const warning =
                alertS === undefined
                  ? '—'
                  : impact.sArrivalS <= alertS
                    ? t('impact.blindZone')
                    : `+${number(impact.sArrivalS - alertS, 1)} s`;
              return (
                <tr key={impact.index} className="break-inside-avoid border-b border-line">
                  <td className="py-1 pr-2">
                    {properties?.name}
                    <span className="text-fg-muted"> · {properties?.province}</span>
                  </td>
                  <td className="py-1 pr-2 num">{number(impact.sArrivalS, 1)} s</td>
                  <td className="py-1 pr-2 num">{mmiRoman(impact.maxMmi)}</td>
                  <td className="py-1 pr-2 num">{warning}</td>
                  <td className="py-1 pr-2 num">
                    {loss ? formatPercent(loss.lossRatio, language, 1) : '—'}
                  </td>
                  <td className="py-1 num">
                    {loss ? number(roundSignificant(loss.fatalities)) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Section>

      <Section title={t('events.title')}>
        <ol className="space-y-1 text-caption">
          {entries.map((entry) => (
            <li key={entry.id} className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2">
              <span className="num text-fg-muted">{clock(entry.timeS)}</span>
              <span>{entryText(t, language, entry)}</span>
            </li>
          ))}
        </ol>
      </Section>

      <Section title={t('report.sections.methods')}>
        <ul className="list-disc space-y-1 pl-4 text-micro text-fg-secondary">
          <li>{t('report.methods.shaking')}</li>
          <li>{t('eew.note')}</li>
          <li>{t('damage.note')}</li>
          <li>{t('network.note')}</li>
          <li>{t('routing.note')}</li>
          <li>{t('tsunami.note')}</li>
          <li>{t('aftershocks.note')}</li>
        </ul>
        <p className="text-caption font-medium text-fg">{t('events.export.disclaimer')}</p>
      </Section>
    </article>,
    document.body,
  );
}
