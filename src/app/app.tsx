import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense } from 'react';

import { TooltipProvider } from '@/components/ui/tooltip';
import { AboutDialog, useAboutShortcut } from '@/features/about';
import { SharedScenario } from '@/features/scenario';
import { usePlaybackLoop, usePlaybackShortcuts } from '@/features/timeline';
import { useTsunamiTrigger } from '@/features/tsunami';
import { useScenarioStore } from '@/state/scenario-store';
import { useUiStore } from '@/state/ui-store';

import { DesktopLayout } from './desktop-layout';
import { PhoneLayout } from './phone-layout';
import { TabletLayout } from './tablet-layout';
import { useLayoutMode } from './use-layout-mode';
import { useThemeSync } from './use-theme-sync';

const queryClient = new QueryClient();

/** The printable report exists only while a scenario is loaded. */
const ScenarioReport = lazy(() =>
  import('@/features/events').then((module) => ({ default: module.ScenarioReport })),
);

export function App() {
  useThemeSync();
  usePlaybackLoop();
  usePlaybackShortcuts();
  useAboutShortcut();
  useTsunamiTrigger();
  const layout = useLayoutMode();
  const hasResult = useScenarioStore((state) => state.result !== null);
  const aboutOpen = useUiStore((state) => state.about !== null);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SharedScenario />
        <Suspense fallback={null}>
          {hasResult && <ScenarioReport />}
          {aboutOpen && <AboutDialog />}
        </Suspense>
        {layout === 'desktop' && <DesktopLayout />}
        {layout === 'tablet' && <TabletLayout />}
        {layout === 'phone' && <PhoneLayout />}
      </TooltipProvider>
    </QueryClientProvider>
  );
}
