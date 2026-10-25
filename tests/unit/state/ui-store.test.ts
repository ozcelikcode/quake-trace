// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import { isPanelId, isRightPanelId, UI_STORAGE_KEY, useUiStore } from '@/state/ui-store';

describe('ui store', () => {
  beforeEach(() => {
    localStorage.clear();
    useUiStore.setState({
      theme: 'dark',
      openDrawer: null,
      rightPanel: 'telemetry',
      phonePanel: 'scenario',
    });
  });

  it('defaults to the dark theme and toggles between themes', () => {
    expect(useUiStore.getState().theme).toBe('dark');
    useUiStore.getState().toggleTheme();
    expect(useUiStore.getState().theme).toBe('light');
    useUiStore.getState().toggleTheme();
    expect(useUiStore.getState().theme).toBe('dark');
  });

  it('persists only the theme', () => {
    useUiStore.getState().toggleTheme();
    useUiStore.getState().setOpenDrawer('left');
    const stored = JSON.parse(localStorage.getItem(UI_STORAGE_KEY) ?? '{}') as {
      state?: Record<string, unknown>;
    };
    expect(stored.state).toEqual({ theme: 'light' });
  });

  it('tracks drawer and panel selection', () => {
    useUiStore.getState().setOpenDrawer('right');
    useUiStore.getState().setRightPanel('events');
    useUiStore.getState().setPhonePanel('impact');
    expect(useUiStore.getState()).toMatchObject({
      openDrawer: 'right',
      rightPanel: 'events',
      phonePanel: 'impact',
    });
  });

  it('guards panel identifiers', () => {
    expect(isPanelId('scenario')).toBe(true);
    expect(isPanelId('map')).toBe(false);
    expect(isRightPanelId('telemetry')).toBe(true);
    expect(isRightPanelId('scenario')).toBe(false);
  });
});
