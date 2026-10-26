import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import { useScenarioStore } from '@/state/scenario-store';

export function ScenarioStatus() {
  const { t, i18n } = useTranslation();
  const status = useScenarioStore((state) => state.status);
  const mw = useScenarioStore((state) => state.result?.rupture.mw);
  const kind = useScenarioStore((state) => state.origin?.kind ?? 'preset');

  const label =
    status === 'computing'
      ? t('status.computing')
      : status === 'error'
        ? t('status.failed')
        : mw === undefined
          ? t('status.idle')
          : kind === 'preset'
            ? t('status.simulation', { mw: formatNumber(mw, i18n.language, 1) })
            : t('status.simulationFrom', {
                source: t(`status.sources.${kind}`),
                mw: formatNumber(mw, i18n.language, 1),
              });

  return (
    <span
      role="status"
      className={cn(
        'inline-flex items-center gap-1.5 text-caption',
        mw === undefined ? 'text-fg-muted' : 'text-fg',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'size-1.5 rounded-full',
          status === 'computing' && 'animate-pulse bg-signal',
          status === 'error' && 'bg-critical',
          status === 'ready' && 'bg-warning',
          status === 'idle' && 'bg-fg-muted',
        )}
      />
      {label}
    </span>
  );
}
