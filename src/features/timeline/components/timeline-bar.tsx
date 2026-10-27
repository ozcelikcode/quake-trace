import { Pause, Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/cn';
import { formatClock } from '@/lib/format';
import {
  isPlaybackSpeed,
  isTimelineScale,
  TIMELINE_SCALES,
  timelineScales,
  usePlaybackStore,
} from '@/state/playback-store';
import { useScenarioStore } from '@/state/scenario-store';
import { useTsunamiStore } from '@/state/tsunami-store';

interface TimelineBarProps {
  compact?: boolean;
  className?: string;
}

/** Slider positions per scale: finer steps than this do not move the thumb by a pixel. */
const SLIDER_STEPS = 2000;

/**
 * The clock rounded to a slider step, so the bar re-renders when the thumb moves rather than on
 * every animation frame.
 */
function sliderTime(timeS: number, durationS: number): number {
  if (durationS <= 0) return 0;
  const step = durationS / SLIDER_STEPS;
  return Math.min(durationS, Math.round(timeS / step) * step);
}

export function TimelineBar({ compact = false, className }: TimelineBarProps) {
  const { t } = useTranslation();
  const timeS = usePlaybackStore((state) => sliderTime(state.timeS, state.durationS));
  // The readout changes ten times a second (formatClock shows tenths).
  const clock = usePlaybackStore((state) => formatClock(state.timeS));
  const durationS = usePlaybackStore((state) => state.durationS);
  const playing = usePlaybackStore((state) => state.playing);
  const speed = usePlaybackStore((state) => state.speed);
  const toggle = usePlaybackStore((state) => state.toggle);
  const seek = usePlaybackStore((state) => state.seek);
  const setSpeed = usePlaybackStore((state) => state.setSpeed);
  const scale = usePlaybackStore((state) => state.scale);
  const extents = usePlaybackStore((state) => state.extents);
  const setScale = usePlaybackStore((state) => state.setScale);
  const tsunamiStatus = useTsunamiStore((state) => state.status);
  const firstCoastS = useTsunamiStore((state) =>
    state.result?.coast.reduce((min, c) => Math.min(min, c.arrivalS), Number.POSITIVE_INFINITY),
  );
  const loaded = durationS > 0;
  const warning = useScenarioStore((state) => state.result?.earlyWarning);
  const largestAftershockS = useScenarioStore((state) => {
    const catalog = state.result?.aftershocks;
    if (!catalog || catalog.count === 0) return undefined;
    let largest = 0;
    catalog.magnitude.forEach((magnitude, i) => {
      if (magnitude > (catalog.magnitude[largest] ?? 0)) largest = i;
    });
    return catalog.timeS[largest];
  });
  const markers = [
    ...(warning
      ? [
          {
            key: 'detection',
            label: t('timeline.detection'),
            timeS: warning.firstTriggerS,
            className: 'bg-wave-p',
          },
          {
            key: 'alert',
            label: t('timeline.alert'),
            timeS: warning.alertS,
            className: 'bg-critical',
          },
        ]
      : []),
    ...(firstCoastS !== undefined && Number.isFinite(firstCoastS)
      ? [
          {
            key: 'tsunami',
            label: t('timeline.tsunamiArrival'),
            timeS: firstCoastS,
            className: 'bg-tsunami-pos',
          },
        ]
      : []),
    ...(largestAftershockS !== undefined
      ? [
          {
            key: 'aftershock',
            label: t('timeline.largestAftershock'),
            timeS: largestAftershockS,
            className: 'bg-aftershock',
          },
        ]
      : []),
  ].filter((marker) => marker.timeS <= durationS);

  return (
    <section
      aria-label={t('timeline.label')}
      className={cn(
        'flex shrink-0 items-center gap-2 bg-surface-1 px-2',
        compact ? 'h-11' : 'h-14 border-t border-line px-3',
        className,
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        disabled={!loaded}
        aria-label={playing ? t('timeline.pause') : t('timeline.play')}
        onClick={toggle}
      >
        {playing ? <Pause /> : <Play />}
      </Button>

      {loaded ? (
        <>
          {/* Phones show the clock in the status bar, so the slider keeps the width. */}
          {!compact && (
            <span className="w-16 shrink-0 num text-caption text-fg" aria-hidden>
              {clock}
            </span>
          )}
          <div className="relative min-w-0 flex-1 ruler px-1">
            {/* Markers share the slider track inset (px-1). */}
            <div className="pointer-events-none absolute inset-y-0 right-1 left-1">
              {markers.map((marker) => (
                <span
                  key={marker.key}
                  aria-hidden
                  title={marker.label}
                  data-testid={`timeline-marker-${marker.key}`}
                  className={cn(
                    'absolute top-0 bottom-0 my-auto h-4 w-0.5 rounded-full',
                    marker.className,
                  )}
                  style={{ left: `${String((marker.timeS / durationS) * 100)}%` }}
                />
              ))}
            </div>
            <Slider
              value={[timeS]}
              min={0}
              max={durationS}
              step={0.1}
              aria-label={t('timeline.seek')}
              onValueChange={([value]) => {
                if (value !== undefined) seek(value);
              }}
            />
          </div>
          <span className="hidden w-16 shrink-0 text-right num text-caption text-fg-muted sm:inline">
            {formatClock(durationS)}
          </span>
          <ToggleGroup
            type="single"
            value={scale}
            aria-label={t('timeline.scale')}
            onValueChange={(value) => {
              if (!isTimelineScale(value)) return;
              // The tsunami is computed on request; its scale opens when the result arrives.
              if (value === 'tsunami' && extents.tsunami <= 0) {
                useTsunamiStore.getState().request({ openScale: true });
              } else {
                setScale(value);
              }
            }}
          >
            {timelineScales.map((option) => (
              <ToggleGroupItem
                key={option}
                value={option}
                className={cn(compact && 'px-1.5')}
                disabled={
                  extents[option] <= 0 &&
                  !(
                    option === 'tsunami' &&
                    (tsunamiStatus === 'pending' || tsunamiStatus === 'computing')
                  )
                }
                title={
                  option === 'tsunami' && tsunamiStatus === 'computing'
                    ? t('timeline.tsunamiComputing')
                    : undefined
                }
              >
                {t(`timeline.scales.${option}`)}
                {option === 'tsunami' && tsunamiStatus === 'computing' && '…'}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          {!compact && (
            <ToggleGroup
              type="single"
              value={String(speed)}
              aria-label={t('timeline.speed')}
              onValueChange={(value) => {
                const next = Number(value);
                if (isPlaybackSpeed(next, scale)) setSpeed(next);
              }}
            >
              {TIMELINE_SCALES[scale].speeds.map((option) => (
                <ToggleGroupItem key={option} value={String(option)} className="num">
                  {option}×
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
        </>
      ) : (
        <div className="relative flex h-7 min-w-0 flex-1 items-center rounded-control border border-line bg-surface-2 ruler px-3">
          <span className="truncate text-caption text-fg-muted">{t('timeline.idle')}</span>
        </div>
      )}
    </section>
  );
}
