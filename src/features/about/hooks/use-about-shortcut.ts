import { useEffect } from 'react';

import { useUiStore } from '@/state/ui-store';

const TEXT_ENTRY = 'input, textarea, select, [contenteditable="true"]';

/** `?` opens the About dialog at the keyboard shortcuts (designSystem.md, Accessibility). */
export function useAboutShortcut(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '?' || event.defaultPrevented || event.ctrlKey || event.metaKey) return;
      if (event.target instanceof Element && event.target.closest(TEXT_ENTRY)) return;
      useUiStore.getState().setAbout('shortcuts');
      event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);
}
