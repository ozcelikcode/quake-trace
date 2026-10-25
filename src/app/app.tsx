import { TooltipProvider } from '@/components/ui/tooltip';

import { DesktopLayout } from './desktop-layout';
import { PhoneLayout } from './phone-layout';
import { TabletLayout } from './tablet-layout';
import { useLayoutMode } from './use-layout-mode';
import { useThemeSync } from './use-theme-sync';

export function App() {
  useThemeSync();
  const layout = useLayoutMode();

  return (
    <TooltipProvider>
      {layout === 'desktop' && <DesktopLayout />}
      {layout === 'tablet' && <TabletLayout />}
      {layout === 'phone' && <PhoneLayout />}
    </TooltipProvider>
  );
}
