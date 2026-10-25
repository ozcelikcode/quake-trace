import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import { Panel, PanelBody, PanelHeader, PanelTitle } from '@/components/ui/panel';
import { MapViewport } from '@/features/map';
import { ScenarioPanel } from '@/features/scenario';
import { TimelineBar } from '@/features/timeline';

import { RightPanelTabs } from './right-panel-tabs';
import { StatusBar } from './status-bar';

export function DesktopLayout() {
  const { t } = useTranslation();
  const scenarioTitleId = useId();

  return (
    <div className="flex h-dvh flex-col">
      <StatusBar layout="desktop" />
      <div className="flex min-h-0 flex-1">
        <Panel
          aria-labelledby={scenarioTitleId}
          className="w-panel-left shrink-0 border-r border-line"
        >
          <PanelHeader>
            <PanelTitle id={scenarioTitleId}>{t('panels.scenario.title')}</PanelTitle>
          </PanelHeader>
          <PanelBody>
            <ScenarioPanel />
          </PanelBody>
        </Panel>
        <main className="relative min-w-0 flex-1">
          <MapViewport />
        </main>
        <Panel className="w-panel-right shrink-0 border-l border-line">
          <RightPanelTabs />
        </Panel>
      </div>
      <TimelineBar />
    </div>
  );
}
