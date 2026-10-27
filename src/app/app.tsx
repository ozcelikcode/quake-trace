import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { TooltipProvider } from '@/components/ui/tooltip';
import { AboutDialog, useAboutShortcut } from '@/features/about';
import { ScenarioReport } from '@/features/events';
import { SharedScenario } from '@/features/scenario';
import { usePlaybackLoop, usePlaybackShortcuts } from '@/features/timeline';
import { useTsunamiTrigger } from '@/features/tsunami';

import { DesktopLayout } from './desktop-layout';
import { PhoneLayout } from './phone-layout';
import { TabletLayout } from './tablet-layout';
import { useLayoutMode } from './use-layout-mode';
import { useThemeSync } from './use-theme-sync';

const queryClient = new QueryClient();

export function App() {
  useThemeSync();
  usePlaybackLoop();
  usePlaybackShortcuts();
  useAboutShortcut();
  useTsunamiTrigger();
  const layout = useLayoutMode();

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SharedScenario />
        <ScenarioReport />
        <AboutDialog />
        {layout === 'desktop' && <DesktopLayout />}
        {layout === 'tablet' && <TabletLayout />}
        {layout === 'phone' && <PhoneLayout />}
      </TooltipProvider>
    </QueryClientProvider>
  );
}
