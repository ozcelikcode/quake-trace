import { useTranslation } from 'react-i18next';

import { useScenarioStore } from '@/state/scenario-store';

/** Always-visible label while simulated data is on the map (productContext.md, Trust). */
export function SimulationWatermark() {
  const { t } = useTranslation();
  const hasResult = useScenarioStore((state) => state.result !== null);
  if (!hasResult) return null;

  return (
    <div className="pointer-events-none absolute top-3 left-3 z-10 rounded-control border border-warning/40 bg-surface-1/90 px-2 py-1 shadow-float backdrop-blur-sm">
      <span className="text-micro font-semibold tracking-widest text-warning uppercase">
        {t('map.watermark')}
      </span>
    </div>
  );
}
