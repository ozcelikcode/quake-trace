import { useTranslation } from 'react-i18next';

import { MMI_ANCHORS, mmiRoman } from '@/lib/color/mmi';
import { useScenarioStore } from '@/state/scenario-store';

const GRADIENT = `linear-gradient(to right, ${MMI_ANCHORS.slice(1)
  .map(([r, g, b]) => `rgb(${String(r)} ${String(g)} ${String(b)})`)
  .join(', ')})`;
const TICKS = [2, 4, 6, 8, 10];

/** Intensity scale and wave keys, shown while a scenario is loaded. */
export function MapLegend() {
  const { t } = useTranslation();
  const result = useScenarioStore((state) => state.result);
  if (!result) return null;

  return (
    <div className="pointer-events-none absolute bottom-16 left-3 z-10 w-56 space-y-2 rounded-panel border border-line bg-surface-1/90 p-3 shadow-float backdrop-blur-sm max-sm:bottom-3 max-sm:w-44 max-sm:p-2">
      <p className="label-micro">{t('map.legend.intensity')}</p>
      <div>
        <div className="h-2 rounded-full" style={{ backgroundImage: GRADIENT }} />
        <div className="mt-1 flex justify-between num text-micro text-fg-muted">
          {TICKS.map((mmi) => (
            <span key={mmi}>{mmiRoman(mmi)}</span>
          ))}
        </div>
      </div>
      <ul className="space-y-1 text-caption text-fg-secondary">
        <li className="flex items-center gap-2">
          <span aria-hidden className="h-0.5 w-5 rounded-full bg-wave-p" />
          {t('map.legend.pWave')}
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden className="h-0.5 w-5 rounded-full bg-wave-s" />
          {t('map.legend.sWave')}
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden className="h-0.5 w-5 rounded-full bg-fg" />
          {t('map.legend.rupture')}
        </li>
        {result.damage && (
          <li className="flex items-center gap-2">
            <span aria-hidden className="flex w-5 justify-between">
              <span className="size-1.5 rounded-full bg-ok" />
              <span className="size-1.5 rounded-full bg-warning" />
              <span className="size-1.5 rounded-full bg-critical" />
            </span>
            {t('map.legend.facilities')}
          </li>
        )}
        {result.earlyWarning && (
          <>
            <li className="flex items-center gap-2">
              <span aria-hidden className="h-0.5 w-5 rounded-full bg-critical" />
              {t('map.legend.blindZone')}
            </li>
            <li className="flex items-center gap-2">
              <span aria-hidden className="mx-1.5 size-2 rounded-full border-2 border-critical" />
              {t('map.legend.estimatedEpicenter')}
            </li>
          </>
        )}
      </ul>
    </div>
  );
}
