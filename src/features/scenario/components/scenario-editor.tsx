import { Dices, Loader2, Play } from 'lucide-react';
import { useEffect, useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { faultSource } from '@/data/fault-source';
import { useJsonDataset } from '@/data/use-dataset';
import { formatNumber } from '@/lib/format';
import { useEditorStore } from '@/state/editor-store';
import type { ScenarioDraft } from '@/types/scenario';

import {
  CUSTOM_SCENARIO_ID,
  defaultDraft,
  magnitudeRange,
  MW_STEP,
  normalizeDraft,
  traceLengthKm,
} from '../lib/custom-scenario';

/** The Main Marmara Fault, where the editor starts. */
const DEFAULT_FAULT = 'TRCF045';
const MAX_SEED = 2 ** 32 - 1;

interface FieldProps {
  label: string;
  /** Current value shown beside the label (sliders name their thumb themselves). */
  value?: string;
  /** The native control the label belongs to. */
  htmlFor?: string;
  children: ReactNode;
}

function Field({ label, value, htmlFor, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        {htmlFor ? (
          <label htmlFor={htmlFor} className="label-micro">
            {label}
          </label>
        ) : (
          <span className="label-micro">{label}</span>
        )}
        {value && <span className="num text-caption text-fg">{value}</span>}
      </div>
      {children}
    </div>
  );
}

interface ScenarioEditorProps {
  activeId: string | null;
  computing: boolean;
  disabled: boolean;
  onRun: (draft: ScenarioDraft) => void;
}

/**
 * Builds a scenario on any mapped fault: magnitude, hypocentre along the trace, depth within
 * the seismogenic layer and seed. The rupture is sized from the magnitude by the engine; the
 * map previews the fault and the hypocentre, and clicking a fault there moves the hypocentre.
 */
export function ScenarioEditor({ activeId, computing, disabled, onRun }: ScenarioEditorProps) {
  const { t, i18n } = useTranslation();
  const faults = useJsonDataset('faults').data;
  const storedDraft = useEditorStore((state) => state.draft);
  const faultFieldId = useId();
  const seedFieldId = useId();

  useEffect(() => {
    if (faults && !useEditorStore.getState().draft) {
      useEditorStore.getState().setDraft(defaultDraft(faults, DEFAULT_FAULT));
    }
  }, [faults]);

  if (!faults || !storedDraft) return null;
  // The map may pick a fault whose limits the other values exceed.
  const draft = normalizeDraft(storedDraft, faults);
  const update = (changes: Partial<ScenarioDraft>) => {
    useEditorStore.getState().setDraft({ ...draft, ...changes });
  };

  const number = (value: number, digits = 0) => formatNumber(value, i18n.language, digits);
  const fault = faults.features.find((f) => f.properties.id === draft.faultId);
  if (!fault) return null;
  const source = faultSource(faults, draft.faultId);
  const lengthKm = traceLengthKm(faults, draft.faultId);
  const range = magnitudeRange(fault);
  const active = activeId === CUSTOM_SCENARIO_ID;
  const Icon = computing && active ? Loader2 : Play;

  return (
    <form
      className="space-y-4"
      aria-label={t('editor.title')}
      onSubmit={(event) => {
        event.preventDefault();
        onRun(draft);
      }}
    >
      <Field label={t('editor.fault')} htmlFor={faultFieldId}>
        <select
          id={faultFieldId}
          value={draft.faultId}
          onChange={(event) => {
            useEditorStore.getState().setDraft(defaultDraft(faults, event.target.value));
          }}
          className="h-8 w-full rounded-control border border-line bg-surface-2 px-2 num text-caption text-fg focus-visible:outline-2 focus-visible:outline-signal pointer-coarse:h-11"
        >
          {faults.features.map(({ properties }) => (
            <option key={properties.id} value={properties.id}>
              {t('editor.faultOption', {
                id: properties.id,
                type: t(`editor.faultTypes.${properties.faultType}`),
                length: number(properties.lengthKm),
              })}
            </option>
          ))}
        </select>
      </Field>

      <Field label={t('editor.magnitude')} value={`Mw ${number(draft.mw, 1)}`}>
        <Slider
          aria-label={t('editor.magnitude')}
          value={[draft.mw]}
          min={range.min}
          max={range.max}
          step={MW_STEP}
          onValueChange={([mw]) => {
            if (mw !== undefined) update({ mw: Math.round(mw * 10) / 10 });
          }}
        />
        <p className="text-micro text-fg-muted">
          {t('editor.magnitudeRange', { min: number(range.min, 1), max: number(range.max, 1) })}
        </p>
      </Field>

      <Field
        label={t('editor.hypocenter')}
        value={t('editor.alongTrace', {
          km: number(draft.hypocenterKm),
          total: number(lengthKm),
        })}
      >
        <Slider
          aria-label={t('editor.hypocenter')}
          value={[draft.hypocenterKm]}
          min={0}
          max={Math.round(lengthKm)}
          step={1}
          onValueChange={([km]) => {
            if (km !== undefined) update({ hypocenterKm: km });
          }}
        />
        <p className="text-micro text-fg-muted">{t('editor.mapHint')}</p>
      </Field>

      <Field label={t('editor.depth')} value={`${number(draft.depthKm)} km`}>
        <Slider
          aria-label={t('editor.depth')}
          value={[draft.depthKm]}
          min={Math.ceil(source.upperDepthKm)}
          max={Math.floor(source.lowerDepthKm)}
          step={1}
          onValueChange={([depthKm]) => {
            if (depthKm !== undefined) update({ depthKm });
          }}
        />
      </Field>

      <Field label={t('editor.seed')} htmlFor={seedFieldId}>
        <div className="flex gap-2">
          <input
            id={seedFieldId}
            type="number"
            inputMode="numeric"
            min={0}
            max={MAX_SEED}
            step={1}
            value={draft.seed}
            onChange={(event) => {
              const seed = Number(event.target.value);
              if (Number.isInteger(seed) && seed >= 0 && seed <= MAX_SEED) update({ seed });
            }}
            className="h-8 min-w-0 flex-1 rounded-control border border-line bg-surface-2 px-2 num text-caption text-fg focus-visible:outline-2 focus-visible:outline-signal pointer-coarse:h-11"
          />
          <Button
            variant="secondary"
            size="icon"
            aria-label={t('editor.randomSeed')}
            onClick={() => {
              update({ seed: Math.floor(Math.random() * MAX_SEED) });
            }}
          >
            <Dices />
          </Button>
        </div>
        <p className="text-micro text-fg-muted">{t('editor.seedHint')}</p>
      </Field>

      <Button type="submit" variant="primary" className="w-full" disabled={disabled}>
        <Icon className={computing && active ? 'animate-spin' : undefined} />
        {t('editor.run')}
      </Button>
    </form>
  );
}
