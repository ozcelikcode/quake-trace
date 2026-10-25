import { useRef } from 'react';
import { useTranslation } from 'react-i18next';

import type { RecordComponent } from '@/types/simulation';

import { useCanvasFrame } from '../hooks/use-canvas-frame';
import { peakUntil, type Envelope } from '../lib/envelope';
import { formatPeak } from '../lib/format-peak';
import { paintBaseline, paintEnvelope, paintMarker } from '../lib/trace-paint';

interface ComponentTraceProps {
  component: RecordComponent;
  envelope: Envelope;
  /** Shared amplitude scale of the focused station, cm/s². */
  scale: number;
  durationS: number;
  triggerS: number | null;
  sArrivalS: number;
}

/** One component of the focused station: label, trace with picks and playhead, peak so far. */
export function ComponentTrace({
  component,
  envelope,
  scale,
  durationS,
  triggerS,
  sArrivalS,
}: ComponentTraceProps) {
  const { t, i18n } = useTranslation();
  const peakRef = useRef<HTMLSpanElement>(null);
  const canvasRef = useCanvasFrame(({ ctx, width, height, pixelRatio, timeS, style }) => {
    const token = (name: string) => style.getPropertyValue(name).trim();
    const view = { width, height, durationS, timeS, scale };
    paintBaseline(ctx, view, token('--border-subtle'), pixelRatio);
    paintEnvelope(ctx, envelope, view, token('--text-secondary'));
    paintMarker(ctx, view, triggerS, token('--wave-p'), pixelRatio);
    paintMarker(ctx, view, sArrivalS, token('--wave-s'), pixelRatio);
    if (timeS < durationS) paintMarker(ctx, view, timeS, token('--text-muted'), pixelRatio);
    if (peakRef.current)
      peakRef.current.textContent = formatPeak(peakUntil(envelope, timeS), i18n.language);
  });

  return (
    <>
      <span aria-hidden className="num text-micro text-fg-muted">
        {component}
      </span>
      <canvas ref={canvasRef} aria-hidden className="h-10 w-full font-mono text-micro" />
      <span className="text-right num text-caption text-fg">
        <span className="sr-only">
          {t('telemetry.peak', { component: t(`telemetry.component.${component}`) })}{' '}
        </span>
        <span ref={peakRef} />
      </span>
    </>
  );
}
