import { useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import type { ObservedComponents } from '@/state/observed-store';
import type { StationRecords } from '@/types/simulation';

import { useCanvasFrame } from '../hooks/use-canvas-frame';
import { buildEnvelope, ENVELOPE_BIN_S, peakUntil, recordPeak } from '../lib/envelope';
import { formatPeak } from '../lib/format-peak';
import { componentSamples } from '../lib/records';
import { paintBaseline, paintEnvelope, paintMarker } from '../lib/trace-paint';

interface StationRowProps {
  records: StationRecords;
  index: number;
  durationS: number;
  triggered: boolean;
  focused: boolean;
  onFocus: (id: string) => void;
  observed?: ObservedComponents | undefined;
}

/** A station in the record section: trigger state, vertical trace and its peak so far. */
export function StationRow({
  records,
  index,
  durationS,
  triggered,
  focused,
  onFocus,
  observed,
}: StationRowProps) {
  const { t, i18n } = useTranslation();
  const station = records.stations[index];
  const envelope = useMemo(
    () =>
      buildEnvelope(
        componentSamples(records, index, 'Z', observed),
        records.sampleRateHz,
        ENVELOPE_BIN_S,
      ),
    [records, index, observed],
  );
  const peakRef = useRef<HTMLSpanElement>(null);
  const canvasRef = useCanvasFrame(({ ctx, width, height, pixelRatio, timeS, style }) => {
    if (!station) return;
    const token = (name: string) => style.getPropertyValue(name).trim();
    const view = { width, height, durationS, timeS, scale: recordPeak(envelope) };
    paintBaseline(ctx, view, token('--border-subtle'), pixelRatio);
    paintEnvelope(ctx, envelope, view, token(triggered ? '--text-secondary' : '--text-muted'));
    // The trigger is picked on the synthetic record; an observed trace shows the model arrivals.
    if (!observed) paintMarker(ctx, view, station.triggerS, token('--wave-p'), pixelRatio);
    else paintMarker(ctx, view, station.pArrivalS, token('--wave-p'), pixelRatio);
    paintMarker(ctx, view, station.sArrivalS, token('--wave-s'), pixelRatio);
    if (peakRef.current)
      peakRef.current.textContent = formatPeak(peakUntil(envelope, timeS), i18n.language);
  });
  if (!station) return null;

  return (
    <li>
      <button
        type="button"
        aria-pressed={focused}
        onClick={() => {
          onFocus(station.id);
        }}
        className={cn(
          'relative grid w-full grid-cols-[0.5rem_4rem_minmax(0,1fr)_4.5rem] items-center gap-2 px-3 py-1.5 text-left transition-colors duration-150 hover:bg-surface-3 focus-visible:-outline-offset-2 pointer-coarse:py-2.5',
          focused &&
            'bg-surface-2 before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-signal',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'size-2 rounded-full border transition-colors duration-150',
            triggered ? 'border-wave-p bg-wave-p' : 'border-line-strong',
          )}
        />
        <span className="min-w-0">
          {/* Observed records are marked by the id in the info hue, as in the focus badge. */}
          <span
            title={observed ? t('telemetry.observed') : undefined}
            className={cn('block truncate num text-caption', observed ? 'text-info' : 'text-fg')}
          >
            {station.id}
            {observed && <span className="sr-only">, {t('telemetry.observed')}</span>}
          </span>
          <span className="block num text-micro text-fg-muted">
            {formatNumber(station.epicentralKm, i18n.language)} km
            <span className="sr-only">
              , {triggered ? t('telemetry.stateTriggered') : t('telemetry.stateWaiting')}
            </span>
          </span>
        </span>
        <canvas ref={canvasRef} aria-hidden className="h-7 w-full" />
        <span ref={peakRef} className="text-right num text-caption text-fg-secondary" />
      </button>
    </li>
  );
}
