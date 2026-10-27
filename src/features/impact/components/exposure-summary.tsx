import { useTranslation } from 'react-i18next';

import { useJsonDataset } from '@/data/use-dataset';
import { mmiCss, mmiRoman } from '@/lib/color/mmi';
import { formatCompact, formatNumber, roundSignificant } from '@/lib/format';
import type { PopulationExposure } from '@/types/exposure';

/** Intensity classes listed: from light shaking (IV), which people widely feel indoors. */
const LISTED_FROM_MMI = 4;
/** Strong shaking (VI) and above, where damage starts. */
const STRONG_MMI = 6;
const LISTED_PROVINCES = 6;

const sumFrom = (counts: readonly number[], from: number) =>
  counts.slice(from).reduce((sum, count) => sum + count, 0);

/** Residents of Türkiye per intensity class and the most strongly shaken provinces. */
export function ExposureSummary({ exposure }: { exposure: PopulationExposure }) {
  const { t, i18n } = useTranslation();
  const names = useJsonDataset('turkeyProvinceNames').data;
  const approximate = (value: number) =>
    value > 0 ? `≈ ${formatCompact(roundSignificant(value), i18n.language)}` : '—';
  const classes = exposure.populationByMmi
    .map((count, level) => ({ level, count }))
    .filter(({ level }) => level >= LISTED_FROM_MMI)
    .reverse();
  const provinceName = (index: number) =>
    names?.provinces.find((province) => province.index === index)?.name ?? '—';

  return (
    <section aria-labelledby="exposure-title" data-testid="exposure-summary" className="space-y-2">
      <h3 id="exposure-title" className="label-micro">
        {t('exposure.title')}
      </h3>
      <ul className="space-y-1">
        {classes.map(({ level, count }) => (
          <li key={level} className="flex items-center gap-2 text-caption">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-control"
              style={{ backgroundColor: mmiCss(level) }}
            />
            <span className="w-8 num text-fg-secondary">{mmiRoman(level)}</span>
            <span className="ml-auto num text-fg">{approximate(count)}</span>
          </li>
        ))}
      </ul>
      {exposure.provinces.length > 0 && (
        <table className="w-full text-caption">
          <caption className="sr-only">{t('exposure.provinces')}</caption>
          <thead>
            <tr className="text-micro text-fg-muted">
              <th scope="col" className="py-1 text-left font-normal">
                {t('exposure.province')}
              </th>
              <th scope="col" className="py-1 text-right font-normal">
                {t('exposure.maxMmi')}
              </th>
              <th scope="col" className="py-1 text-right font-normal">
                {t('exposure.strong')}
              </th>
            </tr>
          </thead>
          <tbody>
            {exposure.provinces.slice(0, LISTED_PROVINCES).map((province) => (
              <tr key={province.index}>
                <td className="py-0.5 text-fg">{provinceName(province.index)}</td>
                <td className="py-0.5 text-right num text-fg-secondary">
                  {mmiRoman(province.maxMmi)}
                </td>
                <td className="py-0.5 text-right num text-fg">
                  {approximate(sumFrom(province.populationByMmi, STRONG_MMI))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="text-micro text-fg-muted">
        {t('exposure.note', {
          total: formatNumber(
            roundSignificant(sumFrom(exposure.populationByMmi, STRONG_MMI)),
            i18n.language,
          ),
        })}
      </p>
    </section>
  );
}
