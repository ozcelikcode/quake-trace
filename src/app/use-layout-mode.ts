import { useMediaQuery } from '@/lib/use-media-query';

export type LayoutMode = 'phone' | 'tablet' | 'desktop';

/** Breakpoints from memory-bank/designSystem.md (Layout). */
export function useLayoutMode(): LayoutMode {
  const isDesktop = useMediaQuery('(min-width: 1280px)');
  const isTablet = useMediaQuery('(min-width: 768px)');
  if (isDesktop) return 'desktop';
  return isTablet ? 'tablet' : 'phone';
}
