import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import { usePlaybackStore } from '@/state/playback-store';
import { useScenarioStore } from '@/state/scenario-store';

import { eewPhase } from '../lib/eew-phase';

/**
 * Early-warning state in the status bar: detection after the first trigger, then the alert with
 * the first magnitude estimate until the shaking ends. A live region announces each change.
 */
/** `compact` (phones) shows only the magnitude next to the alert dot; the full text stays for screen readers. */
export function EewStatus({ compact = false }: { compact?: boolean }) {
  const { t, i18n } = useTranslation();
  const warning = useScenarioStore((state) => state.result?.earlyWarning);
  const phase = usePlaybackStore((state) => eewPhase(warning, state.timeS, state.extents.shaking));

  const label =
    phase === 'alert' && warning
      ? t('eew.alert', { magnitude: formatNumber(warning.magnitude, i18n.language, 1) })
      : phase === 'detected'
        ? t('eew.detected')
        : '';

  return (
    <span
      aria-live="assertive"
      aria-atomic="true"
      data-testid="eew-status"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-control px-1.5 py-0.5 text-caption font-medium whitespace-nowrap',
        phase === 'alert' &&
          'bg-critical text-signal-contrast motion-safe:animate-[pulse_1s_ease-out_1]',
        phase === 'detected' && 'text-warning',
        phase === 'idle' && 'sr-only',
      )}
    >
      {phase !== 'idle' && (
        <span
          aria-hidden
          className={cn(
            'size-1.5 rounded-full',
            phase === 'alert' ? 'bg-signal-contrast' : 'bg-warning',
          )}
        />
      )}
      {compact && phase === 'alert' && warning ? (
        <>
          <span className="sr-only">{label}</span>
          <span aria-hidden className="num">
            M {formatNumber(warning.magnitude, i18n.language, 1)}
          </span>
        </>
      ) : (
        label
      )}
    </span>
  );
}
