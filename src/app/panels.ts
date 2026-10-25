import type { ParseKeys } from 'i18next';
import {
  AudioWaveform,
  Building2,
  ScrollText,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react';
import type { ComponentType } from 'react';

import { EventsPanel } from '@/features/events';
import { ImpactPanel } from '@/features/impact';
import { ScenarioPanel } from '@/features/scenario';
import { TelemetryPanel } from '@/features/telemetry';
import type { PanelId } from '@/state/ui-store';

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
