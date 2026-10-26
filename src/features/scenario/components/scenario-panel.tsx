import { useTranslation } from 'react-i18next';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LivePanel } from '@/features/live';
import { ReplayList } from '@/features/replay';
import { useScenarioStore } from '@/state/scenario-store';
import { useUiStore, type ScenarioTab } from '@/state/ui-store';

import { useRunScenario } from '../hooks/use-run-scenario';
import { SCENARIO_PRESETS } from '../lib/presets';
import { PresetCard } from './preset-card';
import { ScenarioSummary } from './scenario-summary';

const TABS: readonly ScenarioTab[] = ['presets', 'replay', 'live'];

function isScenarioTab(value: string): value is ScenarioTab {
  return (TABS as readonly string[]).includes(value);
}

export function ScenarioPanel() {
  const { t } = useTranslation();
  const { run, ready } = useRunScenario();
  const status = useScenarioStore((state) => state.status);
  const scenarioId = useScenarioStore((state) => state.scenarioId);
  const result = useScenarioStore((state) => state.result);
  const tab = useUiStore((state) => state.scenarioTab);
  const setTab = useUiStore((state) => state.setScenarioTab);
  const computing = status === 'computing';

  return (
    <div className="flex flex-col gap-5 pb-3">
      <Tabs
        value={tab}
        onValueChange={(value) => {
          if (isScenarioTab(value)) setTab(value);
        }}
      >
        <TabsList aria-label={t('scenario.sources')}>
          {TABS.map((option) => (
            <TabsTrigger key={option} value={option}>
              {t(`scenario.tabs.${option}`)}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="presets" className="space-y-2 px-3 pt-3">
          <h3 id="scenario-presets-title" className="label-micro">
            {t('scenario.presetsTitle')}
          </h3>
          <ul className="space-y-2" aria-labelledby="scenario-presets-title">
            {SCENARIO_PRESETS.map((preset) => (
              <li key={preset.id}>
                <PresetCard
                  preset={preset}
                  active={scenarioId === preset.id}
                  computing={computing && scenarioId === preset.id}
                  disabled={!ready || computing}
                  onRun={() => {
                    void run({ kind: 'preset', id: preset.id });
                  }}
                />
              </li>
            ))}
          </ul>
        </TabsContent>
        <TabsContent value="replay" className="space-y-2 px-3 pt-3">
          <ReplayList
            activeId={scenarioId}
            computing={computing}
            disabled={!ready || computing}
            onRun={(event) => {
              void run({ kind: 'replay', event });
            }}
          />
          <p className="text-micro text-fg-muted">{t('replay.note')}</p>
        </TabsContent>
        <TabsContent value="live" className="px-3 pt-3">
          <LivePanel
            activeId={scenarioId}
            computing={computing}
            disabled={!ready || computing}
            onRun={(event) => {
              void run({ kind: 'event', event });
            }}
          />
        </TabsContent>
      </Tabs>

      <div className="flex flex-col gap-5 px-3">
        {status === 'error' && (
          <p role="alert" className="text-caption text-critical">
            {t('scenario.error')}
          </p>
        )}
        {result && <ScenarioSummary result={result} />}
        <p className="text-caption text-fg-muted">{t('scenario.disclaimer')}</p>
      </div>
    </div>
  );
}
