import { useTranslation } from 'react-i18next';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { isRightPanelId, rightPanelIds, useUiStore } from '@/state/ui-store';

import { panelRegistry } from './panels';

export function RightPanelTabs() {
  const { t } = useTranslation();
  const rightPanel = useUiStore((state) => state.rightPanel);
  const setRightPanel = useUiStore((state) => state.setRightPanel);

  return (
    <Tabs
      value={rightPanel}
      onValueChange={(value) => {
        if (isRightPanelId(value)) setRightPanel(value);
      }}
      className="h-full"
    >
      <TabsList>
        {rightPanelIds.map((id) => {
          const { icon: Icon, titleKey } = panelRegistry[id];
          return (
            <TabsTrigger key={id} value={id}>
              <Icon aria-hidden />
              {t(titleKey)}
            </TabsTrigger>
          );
        })}
      </TabsList>
      {rightPanelIds.map((id) => {
        const { Component } = panelRegistry[id];
        return (
          <TabsContent key={id} value={id}>
            <Component />
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
