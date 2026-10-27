import { useState, Suspense } from 'react';
import { useTranslation } from 'react-i18next';

import { BottomSheet, type SheetHeight } from '@/components/ui/bottom-sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MapViewport } from '@/features/map';
import { TimelineBar } from '@/features/timeline';
import { isPanelId, panelIds, useUiStore } from '@/state/ui-store';

import { panelRegistry } from './panels';
import { StatusBar } from './status-bar';

/** Collapsed sheet: handle (20) + compact timeline (44) + tab bar (44) + border. */
const SHEET_PEEK_PX = 112;
const SHEET_SNAP_POINTS = [`${SHEET_PEEK_PX}px`, '50dvh', '88dvh'] as const satisfies readonly [
  SheetHeight,
  ...SheetHeight[],
];

export function PhoneLayout() {
  const { t } = useTranslation();
  const phonePanel = useUiStore((state) => state.phonePanel);
  const setPhonePanel = useUiStore((state) => state.setPhonePanel);
  const [snap, setSnap] = useState(0);

  return (
    <div className="flex h-dvh flex-col">
      <StatusBar layout="phone" />
      <main className="relative min-h-0 flex-1">
        <div className="absolute inset-x-0 top-0" style={{ bottom: SHEET_PEEK_PX }}>
          <MapViewport />
        </div>
      </main>

      <BottomSheet
        label={t('sheet.title')}
        handleLabel={t('sheet.handle')}
        snapPoints={SHEET_SNAP_POINTS}
        snap={snap}
        onSnapChange={setSnap}
        className="pb-[env(safe-area-inset-bottom)]"
      >
        <TimelineBar compact />
        <Tabs
          value={phonePanel}
          onValueChange={(value) => {
            if (!isPanelId(value)) return;
            setPhonePanel(value);
            if (snap === 0) setSnap(1);
          }}
          className="min-h-0 flex-1"
        >
          <TabsList className="justify-between">
            {panelIds.map((id) => {
              const { icon: Icon, titleKey } = panelRegistry[id];
              return (
                <TabsTrigger key={id} value={id} className="flex-1 justify-center">
                  <Icon aria-hidden />
                  {t(titleKey)}
                </TabsTrigger>
              );
            })}
          </TabsList>
          {panelIds.map((id) => {
            const { Component } = panelRegistry[id];
            return (
              <TabsContent key={id} value={id}>
                <Suspense fallback={null}>
                  <Component />
                </Suspense>
              </TabsContent>
            );
          })}
        </Tabs>
      </BottomSheet>
    </div>
  );
}
