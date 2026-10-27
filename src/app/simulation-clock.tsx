import { formatClock } from '@/lib/format';
import { usePlaybackStore } from '@/state/playback-store';

export function SimulationClock() {
  // The formatted string changes ten times a second; selecting it keeps renders at that rate.
  const clock = usePlaybackStore((state) =>
    state.durationS > 0 ? formatClock(state.timeS) : null,
  );
  return (
    <span className="num text-title whitespace-nowrap text-fg" data-testid="simulation-clock">
      T+ {clock ?? '--.-'}
    </span>
  );
}
