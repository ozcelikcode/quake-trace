import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import { usePlaybackStore } from '@/state/playback-store';
import type { FacilityDamage } from '@/types/damage';

import { facilityStatus, type FacilityStatus } from '../lib/facility-status';

const SHOWN: readonly Exclude<FacilityStatus, 'pending'>[] = [
  'operational',
  'limited',
  'outOfService',
];
const DOT: Record<Exclude<FacilityStatus, 'pending'>, string> = {
  operational: 'bg-ok',
  limited: 'bg-warning',
  outOfService: 'bg-critical',
};

/** Critical facilities reached by the S wave, by expected operational state. */
export function InfraSummary({ facilities }: { facilities: FacilityDamage[] }) {
  const { t, i18n } = useTranslation();
  // A compact key of the counts, so the panel re-renders only when a count changes.
  const key = usePlaybackStore((state) => {
    const counts = { operational: 0, limited: 0, outOfService: 0 };
    for (const facility of facilities) {
      const status = facilityStatus(facility.lossRatio, facility.sArrivalS, state.timeS);
      if (status !== 'pending') counts[status]++;
    }
    return `${String(counts.operational)}/${String(counts.limited)}/${String(counts.outOfService)}`;
  });
  const [operational = 0, limited = 0, outOfService = 0] = key.split('/').map(Number);
  const counts = { operational, limited, outOfService };

  return (
    <section aria-labelledby="infra-title" data-testid="infra-summary" className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h3 id="infra-title" className="label-micro">
          {t('infra.title')}
        </h3>
        <span className="num text-micro text-fg-muted">
          {t('infra.reached', {
            count: operational + limited + outOfService,
            total: facilities.length,
          })}
        </span>
      </div>
      <ul className="grid grid-cols-3 gap-px overflow-hidden rounded-panel border border-line bg-line">
        {SHOWN.map((status) => (
          <li key={status} className="bg-surface-1 px-3 py-2">
            <span className="flex items-center gap-1.5 text-micro text-fg-muted">
              <span aria-hidden className={cn('size-2 rounded-full', DOT[status])} />
              {t(`infra.status.${status}`)}
            </span>
            <span className="num text-body text-fg">
              {formatNumber(counts[status], i18n.language)}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-micro text-fg-muted">{t('infra.note')}</p>
    </section>
  );
}
