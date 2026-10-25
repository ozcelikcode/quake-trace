import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { formatNumber } from '@/lib/format';
import { usePlaybackStore } from '@/state/playback-store';
import { RECORD_COMPONENTS, type StationRecords } from '@/types/simulation';

import { buildEnvelope, ENVELOPE_BIN_S, recordPeak } from '../lib/envelope';
import { formatPeak } from '../lib/format-peak';
import { componentSamples } from '../lib/records';
import { ComponentTrace } from './component-trace';
import { TimeAxis } from './time-axis';

interface FocusedStationProps {
  records: StationRecords;
  index: number;
  durationS: number;
}

/** Three-component record of one station on the scenario's time axis, with its site readouts. */
export function FocusedStation({ records, index, durationS }: FocusedStationProps) {
  const { t, i18n } = useTranslation();
  const station = records.stations[index];
  const envelopes = useMemo(
    () =>
      RECORD_COMPONENTS.map((component) =>
        buildEnvelope(
          componentSamples(records, index, component),
          records.sampleRateHz,
          ENVELOPE_BIN_S,
        ),
      ),
    [records, index],
  );
  const triggerS = station?.triggerS ?? null;
  const triggered = usePlaybackStore((state) => triggerS !== null && state.timeS >= triggerS);
  if (!station) return null;

  const number = (value: number, digits = 0) => formatNumber(value, i18n.language, digits);
  const scale = Math.max(...envelopes.map(recordPeak));
  const readouts: [string, string][] = [
    [t('telemetry.epicentral'), `${number(station.epicentralKm)} km`],
    [t('telemetry.rjb'), `${number(station.rjbKm)} km`],
    [t('telemetry.vs30'), `${number(station.vs30)} m/s`],
    [
      t('telemetry.trigger'),
      triggered && triggerS !== null ? `T+${number(triggerS, 1)} s` : t('telemetry.pending'),
    ],
  ];

  return (
    <section
      aria-labelledby="telemetry-focus-title"
      data-testid="telemetry-focus"
      className="sticky top-0 z-10 space-y-2 border-b border-line bg-surface-1 px-3 pt-3 pb-2"
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id="telemetry-focus-title" className="num text-title font-semibold text-fg">
            {station.id}
          </h3>
          <p className="text-micro text-fg-muted">{t('telemetry.instrument')}</p>
        </div>
        <span
          title={t('telemetry.method')}
          className="shrink-0 rounded-control border border-line px-1.5 py-0.5 text-micro text-fg-secondary"
        >
          {t('telemetry.synthetic')}
        </span>
      </header>

      <dl className="grid grid-cols-4 gap-px overflow-hidden rounded-panel border border-line bg-line">
        {readouts.map(([label, value]) => (
          <div key={label} className="bg-surface-1 px-2 py-1.5">
            <dt className="text-micro text-fg-muted">{label}</dt>
            <dd className="num text-caption text-fg">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid grid-cols-[0.75rem_minmax(0,1fr)_3rem] items-center gap-x-2 gap-y-1">
        {RECORD_COMPONENTS.map((component, c) => {
          const envelope = envelopes[c];
          if (!envelope) return null;
          return (
            <ComponentTrace
              key={component}
              component={component}
              envelope={envelope}
              scale={scale}
              durationS={durationS}
              triggerS={triggerS}
              sArrivalS={station.sArrivalS}
            />
          );
        })}
        <span />
        <TimeAxis durationS={durationS} />
        <span />
      </div>

      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-micro text-fg-muted">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-3 w-0.5 bg-wave-p" />
          {t('telemetry.legend.p')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-3 w-0.5 bg-wave-s" />
          {t('telemetry.legend.s')}
        </span>
        <span className="num">
          {t('telemetry.legend.scale', { value: formatPeak(scale, i18n.language) })}
        </span>
      </p>
    </section>
  );
}
