import { Building2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/ui/empty-state';
import { useJsonDataset } from '@/data/use-dataset';
import { mmiCss, mmiRoman } from '@/lib/color/mmi';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import { usePlaybackStore } from '@/state/playback-store';
import { useScenarioStore } from '@/state/scenario-store';

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

  if (!result || !districts) {
    return (
      <EmptyState
        icon={Building2}
        title={t('panels.impact.emptyTitle')}
        description={t('panels.impact.emptyBody')}
      />
    );
  }

  return (
    <section aria-labelledby="impact-title" className="flex flex-col gap-2 p-3">
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
            <th scope="col">{t('impact.intensity')}</th>
          </tr>
        </thead>
        <tbody>
          {impacts.map((impact, position) => {
            const properties = districts.features[impact.index]?.properties;
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
                  <span className="block text-micro text-fg-muted">{properties?.province}</span>
                </td>
                <td className="py-1.5 pr-2 text-right num text-caption text-fg-secondary">
                  {formatNumber(impact.sArrivalS, i18n.language, 1)} s
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
  );
}
