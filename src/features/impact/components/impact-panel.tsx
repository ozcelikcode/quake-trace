import { Building2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/ui/empty-state';
import { useJsonDataset } from '@/data/use-dataset';
import { EewSummary } from '@/features/eew';
import { InfraSummary } from '@/features/infra';
import { mmiCss, mmiRoman } from '@/lib/color/mmi';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import { usePlaybackStore } from '@/state/playback-store';
import { useScenarioStore } from '@/state/scenario-store';

import { DamageSummary } from './damage-summary';

export function ImpactPanel() {
  const { t, i18n } = useTranslation();
  const result = useScenarioStore((state) => state.result);
  const districts = useJsonDataset('districts').data;
  const impacts = result?.districts ?? [];
  // Impacts are sorted by S arrival, so the reached ones form a prefix: re-render on count only.
  const reached = usePlaybackStore((state) => {
    let count = 0;
    while (count < impacts.length && (impacts[count]?.sArrivalS ?? 0) <= state.timeS) count++;
    return count;
  });
  // Countdowns change once a second.
  const second = usePlaybackStore((state) => Math.floor(state.timeS));
  const alertS = result?.earlyWarning?.alertS;

  if (!result || !districts) {
    return (
      <EmptyState
        icon={Building2}
        title={t('panels.impact.emptyTitle')}
        description={t('panels.impact.emptyBody')}
      />
    );
  }

  const number = (value: number, digits = 0) => formatNumber(value, i18n.language, digits);
  const damageByIndex = new Map(result.damage?.districts.map((d) => [d.index, d]));
  const reachedDamage = impacts
    .slice(0, reached)
    .flatMap((impact) => damageByIndex.get(impact.index) ?? []);
  const warningCell = (sArrivalS: number) => {
    if (alertS === undefined || second < alertS) return { text: '—', blind: false };
    if (sArrivalS <= alertS) return { text: t('impact.blindZone'), blind: true };
    if (second < sArrivalS) {
      return {
        text: t('impact.countdown', { seconds: number(Math.ceil(sArrivalS - second)) }),
        blind: false,
      };
    }
    return { text: `+${number(sArrivalS - alertS, 1)} s`, blind: false };
  };

  return (
    <div className="flex flex-col gap-4 p-3">
      <EewSummary result={result} />
      {result.damage && (
        <>
          <DamageSummary reached={reachedDamage} total={impacts.length} />
          <InfraSummary facilities={result.damage.facilities} />
        </>
      )}
      <section aria-labelledby="impact-title" className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <h3 id="impact-title" className="label-micro">
            {t('impact.title')}
          </h3>
          <span className="num text-micro text-fg-muted">
            {t('impact.reached', { count: reached, total: impacts.length })}
          </span>
        </div>
        <table className="w-full text-left">
          <thead className="sr-only">
            <tr>
              <th scope="col">{t('impact.district')}</th>
              <th scope="col">{t('impact.sArrival')}</th>
              <th scope="col">{t('impact.warning')}</th>
              <th scope="col">{t('impact.intensity')}</th>
            </tr>
          </thead>
          <tbody>
            {impacts.map((impact, position) => {
              const properties = districts.features[impact.index]?.properties;
              const warning = warningCell(impact.sArrivalS);
              const damage = position < reached ? damageByIndex.get(impact.index) : undefined;
              return (
                <tr
                  key={impact.index}
                  className={cn(
                    'border-b border-line transition-opacity duration-150 last:border-0',
                    position >= reached && 'opacity-45',
                  )}
                >
                  <td className="py-1.5 pr-2">
                    <span className="block text-body text-fg">{properties?.name}</span>
                    <span className="block text-micro text-fg-muted">
                      {properties?.province}
                      {damage &&
                        ` · ${t('impact.damageLine', {
                          ratio: number(damage.lossRatio * 100, 1),
                          fatalities: number(Math.round(damage.fatalities)),
                        })}`}
                      {damage?.estimated && ` ${t('impact.estimatedStock')}`}
                    </span>
                  </td>
                  <td className="py-1.5 pr-2 text-right num text-caption whitespace-nowrap text-fg-secondary">
                    {number(impact.sArrivalS, 1)} s
                  </td>
                  <td
                    className={cn(
                      'w-20 py-1.5 pr-2 text-right num text-caption whitespace-nowrap',
                      warning.blind ? 'text-critical' : 'text-fg-secondary',
                    )}
                  >
                    {warning.text}
                  </td>
                  <td className="w-14 py-1.5 text-right">
                    <span className="inline-flex items-center gap-1.5 num text-caption text-fg">
                      <span
                        aria-hidden
                        className="size-2.5 rounded-full border border-line-strong"
                        style={{ backgroundColor: mmiCss(impact.maxMmi) }}
                      />
                      {mmiRoman(impact.maxMmi)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
