import { Pause, Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/cn';
import { formatClock } from '@/lib/format';
import { isPlaybackSpeed, PLAYBACK_SPEEDS, usePlaybackStore } from '@/state/playback-store';

interface TimelineBarProps {
  compact?: boolean;
  className?: string;
}

export function TimelineBar({ compact = false, className }: TimelineBarProps) {
  const { t } = useTranslation();
  const timeS = usePlaybackStore((state) => state.timeS);
  const durationS = usePlaybackStore((state) => state.durationS);
  const playing = usePlaybackStore((state) => state.playing);
  const speed = usePlaybackStore((state) => state.speed);
  const toggle = usePlaybackStore((state) => state.toggle);
  const seek = usePlaybackStore((state) => state.seek);
  const setSpeed = usePlaybackStore((state) => state.setSpeed);
  const loaded = durationS > 0;

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
          <span className="w-16 shrink-0 num text-caption text-fg" aria-hidden>
            {formatClock(timeS)}
          </span>
          <div className="relative min-w-0 flex-1 ruler px-1">
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
          {!compact && (
            <ToggleGroup
              type="single"
              value={String(speed)}
              aria-label={t('timeline.speed')}
              onValueChange={(value) => {
                const next = Number(value);
                if (isPlaybackSpeed(next)) setSpeed(next);
              }}
            >
              {PLAYBACK_SPEEDS.map((option) => (
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
