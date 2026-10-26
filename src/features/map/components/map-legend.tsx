import { useTranslation } from 'react-i18next';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { MMI_ANCHORS, mmiRoman } from '@/lib/color/mmi';
import { formatCompact, formatNumber } from '@/lib/format';
import { useScenarioStore } from '@/state/scenario-store';
import { useTsunamiStore } from '@/state/tsunami-store';
import { useUiStore, type MapRaster } from '@/state/ui-store';
import { IMPAIRMENTS } from '@/types/routing';

import { LOAD_ANCHORS, TSUNAMI_NEG, TSUNAMI_POS } from '../lib/layer-palette';
import {
  BLOCKED_DENSITY_MAX,
  BLOCKED_DENSITY_MIN,
  TSUNAMI_SCALE_M,
} from '../lib/simulation-frames';

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

const TSUNAMI_GRADIENT = `linear-gradient(to right, rgb(${TSUNAMI_NEG.join(' ')}), transparent, rgb(${TSUNAMI_POS.join(' ')}))`;
const TSUNAMI_TICKS = [-TSUNAMI_SCALE_M, 0, TSUNAMI_SCALE_M];
const RASTERS: readonly MapRaster[] = ['intensity', 'network', 'tsunami'];

function isMapRaster(value: string): value is MapRaster {
  return (RASTERS as readonly string[]).includes(value);
}

/** One scale: gradient bar and tick labels spread evenly underneath. */
function Scale({ gradient: background, ticks }: { gradient: string; ticks: string[] }) {
  return (
    <div>
      <div className="h-2 rounded-full" style={{ backgroundImage: background }} />
      <div className="mt-1 flex justify-between num text-micro text-fg-muted">
        {ticks.map((tick) => (
          <span key={tick}>{tick}</span>
        ))}
      </div>
    </div>
  );
}

/** Raster scale (intensity, blocked calls or sea surface) and keys, while a scenario is loaded. */
export function MapLegend() {
  const { t, i18n } = useTranslation();
  const result = useScenarioStore((state) => state.result);
  const tsunamiReady = useTsunamiStore((state) => state.result !== null);
  const raster = useUiStore((state) => state.mapRaster);
  const setRaster = useUiStore((state) => state.setMapRaster);
  if (!result) return null;
  const available: Record<MapRaster, boolean> = {
    intensity: true,
    network: result.network !== null,
    tsunami: tsunamiReady,
  };
  const shown = available[raster] ? raster : 'intensity';
  const labels: Record<MapRaster, string> = {
    intensity: t('map.legend.rasterIntensity'),
    network: t('map.legend.rasterNetwork'),
    tsunami: t('map.legend.rasterTsunami'),
  };
  const scales: Record<MapRaster, { title: string; gradient: string; ticks: string[] }> = {
    intensity: {
      title: t('map.legend.intensity'),
      gradient: MMI_GRADIENT,
      ticks: MMI_TICKS.map(mmiRoman),
    },
    // Ticks 10, 100, 1,000, 10,000 sit evenly on the logarithmic scale.
    network: {
      title: t('map.legend.network'),
      gradient: LOAD_GRADIENT,
      ticks: LOAD_TICKS.map((density) => formatCompact(density, i18n.language)),
    },
    tsunami: {
      title: t('map.legend.tsunami'),
      gradient: TSUNAMI_GRADIENT,
      ticks: TSUNAMI_TICKS.map(
        (value) => `${value > 0 ? '+' : ''}${formatNumber(value, i18n.language, 1)}`,
      ),
    },
  };
  const scale = scales[shown];

  return (
    <div className="pointer-events-none absolute bottom-16 left-3 z-10 w-60 space-y-2 rounded-panel border border-line bg-surface-1/90 p-3 shadow-float backdrop-blur-sm max-sm:top-14 max-sm:bottom-auto max-sm:w-44 max-sm:space-y-1.5 max-sm:p-2">
      {available.network && (
        <ToggleGroup
          type="single"
          value={shown}
          onValueChange={(value) => {
            if (isMapRaster(value)) setRaster(value);
          }}
          aria-label={t('map.legend.raster')}
          className="pointer-events-auto w-full"
        >
          {RASTERS.filter((option) => available[option]).map((option) => (
            <ToggleGroupItem key={option} value={option} className="flex-1 px-1">
              {labels[option]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}
      <p className="label-micro">{scale.title}</p>
      <Scale gradient={scale.gradient} ticks={scale.ticks} />
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
        {result.aftershocks.count > 0 && (
          <li className="flex items-center gap-2">
            <span aria-hidden className="flex w-5 items-center justify-between">
              <span className="size-1 rounded-full bg-aftershock" />
              <span className="size-2.5 rounded-full bg-aftershock" />
            </span>
            {t('map.legend.aftershocks')}
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
