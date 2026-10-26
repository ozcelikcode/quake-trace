import { useTranslation } from 'react-i18next';

import { formatNumber } from '@/lib/format';
import type { DistrictDamage } from '@/types/damage';

import { roundSignificant } from '../lib/round-significant';

interface DamageSummaryProps {
  /** Damage of the districts the S wave has reached. */
  reached: DistrictDamage[];
  total: number;
}

/** Expected losses so far: buildings, loss ratio and night-time fatalities. */
export function DamageSummary({ reached, total }: DamageSummaryProps) {
  const { t, i18n } = useTranslation();
  const buildings = reached.reduce((sum, d) => sum + d.buildings, 0);
  const lost = reached.reduce((sum, d) => sum + d.buildingsLost, 0);
  const fatalities = reached.reduce((sum, d) => sum + d.fatalities, 0);
  const approximate = (value: number) =>
    `≈ ${formatNumber(roundSignificant(value), i18n.language)}`;

  const rows: [string, string][] = [
    [t('damage.buildingsLost'), approximate(lost)],
    [
      t('damage.lossRatio'),
      buildings > 0 ? `%${formatNumber((lost / buildings) * 100, i18n.language, 1)}` : '—',
    ],
    [t('damage.fatalities'), approximate(fatalities)],
    [
      t('damage.districts'),
      `${formatNumber(reached.length, i18n.language)} / ${formatNumber(total, i18n.language)}`,
    ],
  ];

  return (
    <section aria-labelledby="damage-title" data-testid="damage-summary" className="space-y-2">
      <h3 id="damage-title" className="label-micro">
        {t('damage.title')}
      </h3>
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-line bg-line">
        {rows.map(([label, value]) => (
          <div key={label} className="bg-surface-1 px-3 py-2">
            <dt className="text-micro text-fg-muted">{label}</dt>
            <dd className="num text-body text-fg">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-micro text-fg-muted">{t('damage.note')}</p>
    </section>
  );
}
