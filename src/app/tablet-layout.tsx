import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { PanelBody, PanelHeader } from '@/components/ui/panel';
import { Sheet, SheetClose, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { MapViewport } from '@/features/map';
import { ScenarioPanel } from '@/features/scenario';
import { TimelineBar } from '@/features/timeline';
import { useUiStore, type DrawerSide } from '@/state/ui-store';

import { RightPanelTabs } from './right-panel-tabs';
import { StatusBar } from './status-bar';

function SideSheet({
  side,
  title,
  children,
}: {
  side: DrawerSide;
  title: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const openDrawer = useUiStore((state) => state.openDrawer);
  const setOpenDrawer = useUiStore((state) => state.setOpenDrawer);

  return (
    <Sheet
      open={openDrawer === side}
      onOpenChange={(open) => {
        setOpenDrawer(open ? side : null);
      }}
    >
      <SheetContent side={side} aria-describedby={undefined}>
        <PanelHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetClose asChild>
            <Button variant="ghost" size="icon" aria-label={t('common.close')}>
              <X />
            </Button>
          </SheetClose>
        </PanelHeader>
        <PanelBody className="flex flex-col">{children}</PanelBody>
      </SheetContent>
    </Sheet>
  );
}

export function TabletLayout() {
  const { t } = useTranslation();

  return (
    <div className="flex h-dvh flex-col">
      <StatusBar layout="tablet" />
      <main className="relative min-h-0 flex-1">
        <MapViewport />
      </main>
      <TimelineBar />

      <SideSheet side="left" title={t('panels.scenario.title')}>
        <ScenarioPanel />
      </SideSheet>
      <SideSheet side="right" title={t('panels.info.title')}>
        <RightPanelTabs />
      </SideSheet>
    </div>
  );
}
