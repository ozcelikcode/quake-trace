import { useTranslation } from 'react-i18next';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { MMI_ANCHORS, mmiRoman } from '@/lib/color/mmi';
import { formatCompact } from '@/lib/format';
import { useScenarioStore } from '@/state/scenario-store';
import { useUiStore, type MapRaster } from '@/state/ui-store';
import { IMPAIRMENTS } from '@/types/routing';

import { LOAD_ANCHORS } from '../lib/layer-palette';
import { BLOCKED_DENSITY_MAX, BLOCKED_DENSITY_MIN } from '../lib/simulation-frames';

const gradient = (anchors: readonly (readonly [number, number, number])[]) =>
  `linear-gradient(to right, ${anchors
    .map(([r, g, b]) => `rgb(${String(r)} ${String(g)} ${String(b)})`)
    .join(', ')})`;
const MMI_GRADIENT = gradient(MMI_ANCHORS.slice(1));
const LOAD_GRADIENT = gradient(LOAD_ANCHORS);
const MMI_TICKS = [2, 4, 6, 8, 10];
/** Density ticks on the logarithmic load scale, people per km². */
const LOAD_TICKS = [BLOCKED_DENSITY_MIN, 100, 1000, BLOCKED_DENSITY_MAX];
const BRIDGE_CLOSED = IMPAIRMENTS.indexOf('bridgeClosed');

function isMapRaster(value: string): value is MapRaster {
  return value === 'intensity' || value === 'network';
}

/** Raster scale (intensity or blocked calls) and keys, shown while a scenario is loaded. */
export function MapLegend() {
  const { t, i18n } = useTranslation();
  const result = useScenarioStore((state) => state.result);
  const raster = useUiStore((state) => state.mapRaster);
  const setRaster = useUiStore((state) => state.setMapRaster);
  if (!result) return null;
  const showNetwork = raster === 'network' && result.network !== null;

  return (
    <div className="pointer-events-none absolute bottom-16 left-3 z-10 w-60 space-y-2 rounded-panel border border-line bg-surface-1/90 p-3 shadow-float backdrop-blur-sm max-sm:top-14 max-sm:bottom-auto max-sm:w-48 max-sm:p-2">
      {result.network && (
        <ToggleGroup
          type="single"
          value={raster}
          onValueChange={(value) => {
            if (isMapRaster(value)) setRaster(value);
          }}
          aria-label={t('map.legend.raster')}
          className="pointer-events-auto w-full"
        >
          <ToggleGroupItem value="intensity" className="flex-1">
            {t('map.legend.rasterIntensity')}
          </ToggleGroupItem>
          <ToggleGroupItem value="network" className="flex-1">
            {t('map.legend.rasterNetwork')}
          </ToggleGroupItem>
        </ToggleGroup>
      )}
      <p className="label-micro">
        {showNetwork ? t('map.legend.network') : t('map.legend.intensity')}
      </p>
      <div>
        <div
          className="h-2 rounded-full"
          style={{ backgroundImage: showNetwork ? LOAD_GRADIENT : MMI_GRADIENT }}
        />
        {showNetwork ? (
          <div className="relative mt-1 h-4 num text-micro text-fg-muted">
            {LOAD_TICKS.map((density) => {
              const position =
                Math.log(density / BLOCKED_DENSITY_MIN) /
                Math.log(BLOCKED_DENSITY_MAX / BLOCKED_DENSITY_MIN);
              return (
                <span
                  key={density}
                  className="absolute -translate-x-1/2 first:translate-x-0 last:-translate-x-full"
                  style={{ left: `${String(position * 100)}%` }}
                >
                  {formatCompact(density, i18n.language)}
                </span>
              );
            })}
          </div>
        ) : (
          <div className="mt-1 flex justify-between num text-micro text-fg-muted">
            {MMI_TICKS.map((mmi) => (
              <span key={mmi}>{mmiRoman(mmi)}</span>
            ))}
          </div>
        )}
      </div>
      <ul className="space-y-1 text-caption text-fg-secondary max-sm:hidden">
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
        {result.routing && (
          <>
            <li className="flex items-center gap-2">
              <span aria-hidden className="h-1 w-5 rounded-full bg-fg ring-1 ring-surface-0" />
              {t('map.legend.corridors')}
            </li>
            <li className="flex items-center gap-2">
              <span aria-hidden className="h-0 w-5 border-t-2 border-dashed border-warning" />
              {t('map.legend.debris')}
            </li>
            {result.routing.impairment.includes(BRIDGE_CLOSED) && (
              <li className="flex items-center gap-2">
                <span aria-hidden className="h-1 w-5 rounded-full bg-critical" />
                {t('map.legend.bridgeClosed')}
              </li>
            )}
          </>
        )}
        {result.network && (
          <li className="flex items-center gap-2">
            <span aria-hidden className="flex w-5 justify-between">
              <span className="size-1 rounded-full bg-ok" />
              <span className="size-1 rounded-full bg-warning" />
              <span className="size-1 rounded-full bg-critical" />
            </span>
            {t('map.legend.sites')}
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
