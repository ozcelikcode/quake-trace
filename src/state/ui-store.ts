import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type Theme = 'dark' | 'light';
export type DrawerSide = 'left' | 'right';
export type PanelId = 'scenario' | 'telemetry' | 'impact' | 'events';
/** Quantity drawn as the map raster while a scenario is loaded. */
export type MapRaster = 'intensity' | 'network' | 'tsunami';
/** Sections of the About dialog. */
export const aboutSections = ['overview', 'methods', 'data', 'shortcuts'] as const;
export type AboutSection = (typeof aboutSections)[number];
/** Sources of a scenario in the scenario panel. */
export type ScenarioTab = 'presets' | 'editor' | 'replay' | 'live';

/** Panels shown in the right column on desktop and in the right drawer on tablets. */
export const rightPanelIds = [
  'telemetry',
  'impact',
  'events',
] as const satisfies readonly PanelId[];
export type RightPanelId = (typeof rightPanelIds)[number];

/** All panels, in the order of the phone bottom-sheet tabs. */
export const panelIds = ['scenario', ...rightPanelIds] as const satisfies readonly PanelId[];

export function isPanelId(value: string): value is PanelId {
  return (panelIds as readonly string[]).includes(value);
}

export function isRightPanelId(value: string): value is RightPanelId {
  return (rightPanelIds as readonly string[]).includes(value);
}

/**
 * 3D terrain starts on only where it is affordable: wide screens with at least six logical
 * cores. Phones and small laptops draw the flat map with hillshade (terrain tiles and the draped
 * raster are the largest GPU cost); the map's terrain button turns it on.
 */
function terrainByDefault(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(min-width: 641px)').matches && navigator.hardwareConcurrency >= 6;
}

/** Storage key read by the inline script in index.html to apply the theme before first paint. */
export const UI_STORAGE_KEY = 'quaketrace-ui';

interface UiState {
  theme: Theme;
  openDrawer: DrawerSide | null;
  rightPanel: RightPanelId;
  phonePanel: PanelId;
  mapRaster: MapRaster;
  /** Whether the map drapes everything on 3D terrain. */
  terrain: boolean;
  scenarioTab: ScenarioTab;
  /** Open section of the About dialog, null when it is closed. */
  about: AboutSection | null;
  toggleTheme: () => void;
  setOpenDrawer: (side: DrawerSide | null) => void;
  setRightPanel: (panel: RightPanelId) => void;
  setPhonePanel: (panel: PanelId) => void;
  setMapRaster: (raster: MapRaster) => void;
  setTerrain: (terrain: boolean) => void;
  setScenarioTab: (tab: ScenarioTab) => void;
  setAbout: (section: AboutSection | null) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: 'dark',
      openDrawer: null,
      rightPanel: 'telemetry',
      phonePanel: 'scenario',
      mapRaster: 'intensity',
      terrain: terrainByDefault(),
      scenarioTab: 'presets',
      about: null,
      toggleTheme: () => {
        set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' }));
      },
      setOpenDrawer: (openDrawer) => {
        set({ openDrawer });
      },
      setRightPanel: (rightPanel) => {
        set({ rightPanel });
      },
      setPhonePanel: (phonePanel) => {
        set({ phonePanel });
      },
      setMapRaster: (mapRaster) => {
        set({ mapRaster });
      },
      setTerrain: (terrain) => {
        set({ terrain });
      },
      setScenarioTab: (scenarioTab) => {
        set({ scenarioTab });
      },
      setAbout: (about) => {
        set({ about });
      },
    }),
    {
      name: UI_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ theme: state.theme, terrain: state.terrain }),
    },
  ),
);
