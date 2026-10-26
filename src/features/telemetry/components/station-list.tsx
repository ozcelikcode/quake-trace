import { useTranslation } from 'react-i18next';

import type { ObservedComponents } from '@/state/observed-store';
import type { StationRecords } from '@/types/simulation';

import { StationRow } from './station-row';

interface StationListProps {
  records: StationRecords;
  /** Station indices in trigger order. */
  order: number[];
  /** Stations in `order` that have triggered by now (a prefix). */
  triggeredCount: number;
  focusedIndex: number;
  durationS: number;
  onFocus: (id: string) => void;
  /** Observed records by station id, when real records were fetched. */
  observed?: Record<string, ObservedComponents> | undefined;
}

/**
 * Every station as a row on the shared time axis, in trigger order: read top to bottom, the
 * picks form the moveout of the P and S waves across the network.
 */
export function StationList({
  records,
  order,
  triggeredCount,
  focusedIndex,
  durationS,
  onFocus,
  observed,
}: StationListProps) {
  const { t } = useTranslation();

  return (
    <section aria-labelledby="telemetry-stations-title" className="py-2">
      <div className="flex items-baseline justify-between gap-2 px-3 pb-1">
        <h3 id="telemetry-stations-title" className="label-micro">
          {t('telemetry.stationsTitle')}
        </h3>
        <span data-testid="telemetry-triggered" className="num text-micro text-fg-muted">
          {t('telemetry.triggered', { count: triggeredCount, total: order.length })}
        </span>
      </div>
      <div
        aria-hidden
        className="grid grid-cols-[0.5rem_4rem_minmax(0,1fr)_4.5rem] gap-2 px-3 pb-1 text-micro text-fg-muted"
      >
        <span />
        <span>{t('telemetry.columns.station')}</span>
        <span>{t('telemetry.columns.trace')}</span>
        <span className="text-right whitespace-nowrap">{t('telemetry.columns.peak')}</span>
      </div>
      <ul>
        {order.map((index, position) => (
          <StationRow
            key={records.stations[index]?.id ?? index}
            records={records}
            index={index}
            durationS={durationS}
            triggered={position < triggeredCount}
            focused={index === focusedIndex}
            onFocus={onFocus}
            observed={observed?.[records.stations[index]?.id ?? '']}
          />
        ))}
      </ul>
      <p className="px-3 pt-2 text-micro text-fg-muted">{t('telemetry.scaleNote')}</p>
    </section>
  );
}
