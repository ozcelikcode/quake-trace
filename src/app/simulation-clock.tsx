import { formatClock } from '@/lib/format';
import { usePlaybackStore } from '@/state/playback-store';

export function SimulationClock() {
  const timeS = usePlaybackStore((state) => state.timeS);
  const loaded = usePlaybackStore((state) => state.durationS > 0);
  return (
    <span className="num text-title whitespace-nowrap text-fg" data-testid="simulation-clock">
      T+ {loaded ? formatClock(timeS) : '--.-'}
    </span>
  );
}
