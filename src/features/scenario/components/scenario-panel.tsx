import { useTranslation } from 'react-i18next';

import { useScenarioStore } from '@/state/scenario-store';

import { useRunScenario } from '../hooks/use-run-scenario';
import { SCENARIO_PRESETS } from '../lib/presets';
import { PresetCard } from './preset-card';
import { ScenarioSummary } from './scenario-summary';

export function ScenarioPanel() {
  const { t } = useTranslation();
  const { run, ready } = useRunScenario();
  const status = useScenarioStore((state) => state.status);
  const presetId = useScenarioStore((state) => state.presetId);
  const result = useScenarioStore((state) => state.result);
  const computing = status === 'computing';

  return (
    <div className="flex flex-col gap-5 p-3">
      <section aria-labelledby="scenario-presets-title" className="space-y-2">
        <h3 id="scenario-presets-title" className="label-micro">
          {t('scenario.presetsTitle')}
        </h3>
        <ul className="space-y-2">
          {SCENARIO_PRESETS.map((preset) => (
            <li key={preset.id}>
              <PresetCard
                preset={preset}
                active={presetId === preset.id}
                computing={computing && presetId === preset.id}
                disabled={!ready || computing}
                onRun={() => {
                  void run(preset.id);
                }}
              />
            </li>
          ))}
        </ul>
      </section>

      {status === 'error' && (
        <p role="alert" className="text-caption text-critical">
          {t('scenario.error')}
        </p>
      )}
      {result && <ScenarioSummary result={result} />}

      <p className="text-caption text-fg-muted">{t('scenario.disclaimer')}</p>
    </div>
  );
}
