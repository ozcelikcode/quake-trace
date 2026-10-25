import { useEffect } from 'react';

import { useUiStore } from '@/state/ui-store';

/** Mirrors the theme preference onto <html data-theme> and the browser theme color. */
export function useThemeSync(): void {
  const theme = useUiStore((state) => state.theme);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    const surface = getComputedStyle(root).getPropertyValue('--surface-0').trim();
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', surface);
  }, [theme]);
}
