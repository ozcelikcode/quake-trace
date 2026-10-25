import { Loader2, Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';

import type { ScenarioPreset } from '../lib/presets';

interface PresetCardProps {
  preset: ScenarioPreset;
  active: boolean;
  computing: boolean;
  disabled: boolean;
  onRun: () => void;
}

export function PresetCard({ preset, active, computing, disabled, onRun }: PresetCardProps) {
  const { t, i18n } = useTranslation();
  const lon = (value: number) => `${formatNumber(value, i18n.language, 2)}°`;
  const Icon = computing ? Loader2 : Play;

  return (
    <button
      type="button"
      disabled={disabled}
      aria-current={active ? 'true' : undefined}
      onClick={onRun}
      className={cn(
        'group flex w-full items-start gap-3 rounded-panel border border-line bg-surface-1 p-3 text-left transition-colors duration-150 hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-60',
        active && 'border-signal bg-surface-2',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'mt-0.5 grid size-7 shrink-0 place-items-center rounded-control border border-line bg-surface-2 text-fg-secondary group-hover:text-fg',
          active && 'border-signal text-signal',
        )}
      >
        <Icon className={cn('size-3.5', computing && 'animate-spin')} />
      </span>
      <span className="min-w-0 space-y-1">
        <span className="block text-body font-medium text-fg">
          {t(`scenario.presets.${preset.id}.name`)}
        </span>
        <span className="block text-caption text-fg-muted">
          {t(`scenario.presets.${preset.id}.description`)}
        </span>
        <span className="block num text-micro text-fg-muted">
          {t('scenario.extent', { from: lon(preset.fromLon), to: lon(preset.toLon) })}
        </span>
      </span>
    </button>
  );
}
