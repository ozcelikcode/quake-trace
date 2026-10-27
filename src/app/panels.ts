import type { ParseKeys } from 'i18next';
import {
  AudioWaveform,
  Building2,
  ScrollText,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react';
import { lazy, type ComponentType } from 'react';

import { ScenarioPanel } from '@/features/scenario';
import type { PanelId } from '@/state/ui-store';

/*
 * The scenario panel is the first thing used; the others load with their tab (Radix tabs mount
 * only the active content), which keeps them out of the start-up bundle. Layouts render panels
 * inside a Suspense boundary.
 */
const TelemetryPanel = lazy(() =>
  import('@/features/telemetry').then((module) => ({ default: module.TelemetryPanel })),
);
const ImpactPanel = lazy(() =>
  import('@/features/impact').then((module) => ({ default: module.ImpactPanel })),
);
const EventsPanel = lazy(() =>
  import('@/features/events').then((module) => ({ default: module.EventsPanel })),
);

interface PanelDefinition {
  titleKey: ParseKeys;
  icon: LucideIcon;
  Component: ComponentType;
}

/** Single source for panel titles, icons and content across all layouts. */
export const panelRegistry: Record<PanelId, PanelDefinition> = {
  scenario: {
    titleKey: 'panels.scenario.title',
    icon: SlidersHorizontal,
    Component: ScenarioPanel,
  },
  telemetry: { titleKey: 'panels.telemetry.title', icon: AudioWaveform, Component: TelemetryPanel },
  impact: { titleKey: 'panels.impact.title', icon: Building2, Component: ImpactPanel },
  events: { titleKey: 'panels.events.title', icon: ScrollText, Component: EventsPanel },
};
