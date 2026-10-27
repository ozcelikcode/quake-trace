import { lazy } from 'react';

export { useAboutShortcut } from './hooks/use-about-shortcut';

/** Loaded the first time the dialog opens. */
export const AboutDialog = lazy(() =>
  import('./components/about-dialog').then((module) => ({ default: module.AboutDialog })),
);
