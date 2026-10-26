import { useEffect, useRef } from 'react';

import { useJsonDataset } from '@/data/use-dataset';
import { useScenarioStore } from '@/state/scenario-store';
import { useEditorStore } from '@/state/editor-store';
import { useUiStore } from '@/state/ui-store';

import { decodeRunRequest } from '../lib/run-request';
import { useRunScenario } from '../hooks/use-run-scenario';

/**
 * Runs the scenario in the page's share link once the data it needs has loaded. An editor link
 * also fills the editor, so the shared scenario can be adjusted from where it was left. Renders
 * nothing; it lives in the app shell because the scenario panel may not be mounted.
 */
export function SharedScenario() {
  const { run, ready } = useRunScenario();
  const faults = useJsonDataset('faults').data;
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current || !ready || !faults) return;
    handled.current = true;
    const request = decodeRunRequest(window.location.search);
    if (request === null) return;
    const unknownFault =
      request !== 'invalid' &&
      request.kind === 'custom' &&
      !faults.features.some((fault) => fault.properties.id === request.draft.faultId);
    if (request === 'invalid' || unknownFault) {
      useScenarioStore.getState().fail('link');
      return;
    }
    if (request.kind === 'custom') {
      useEditorStore.getState().setDraft(request.draft);
      useUiStore.getState().setScenarioTab('editor');
    } else if (request.kind === 'replay' || request.kind === 'event') {
      useUiStore.getState().setScenarioTab(request.kind === 'replay' ? 'replay' : 'live');
    }
    void run(request);
  }, [ready, faults, run]);

  return null;
}
