import { faultSource } from '@/data/fault-source';
import type { Fault, Faults } from '@/data/schemas';
import { cumulativeLengthsKm } from '@/lib/math/polyline';
import type { Scenario, ScenarioDraft } from '@/types/scenario';

/** Id of every editor scenario; the parameters travel in the share link, not in the id. */
export const CUSTOM_SCENARIO_ID = 'custom';

/** Smallest magnitude the editor offers: below it the finite-fault model adds little. */
const MIN_DRAFT_MW = 5;
const DEFAULT_DRAFT_MW = 7;
export const MW_STEP = 0.1;

/**
 * Magnitude range of a fault in the editor: up to the 95th percentile of its EFSM20 maximum
 * magnitude (doi:10.13127/efsm20, from Leonard 2014 scaling), rounded down to the step.
 */
export function magnitudeRange(fault: Fault): { min: number; max: number } {
  const max = Math.floor(fault.properties.mwMax.p95 * 10 + 1e-9) / 10;
  return { min: MIN_DRAFT_MW, max: Math.max(MIN_DRAFT_MW, max) };
}

/** Length of the fault trace the hypocentre can be placed on, km. */
export function traceLengthKm(faults: Faults, faultId: string): number {
  return cumulativeLengthsKm(faultSource(faults, faultId).trace).at(-1) ?? 0;
}

/**
 * A starting draft on a fault: Mw 7 (or the fault's limit), hypocentre at the middle of the
 * trace and of the seismogenic layer, seed 1 like the presets.
 */
export function defaultDraft(faults: Faults, faultId: string): ScenarioDraft {
  const fault = faults.features.find((f) => f.properties.id === faultId);
  const source = faultSource(faults, faultId);
  const range = fault ? magnitudeRange(fault) : { min: MIN_DRAFT_MW, max: DEFAULT_DRAFT_MW };
  return {
    faultId,
    mw: Math.min(range.max, DEFAULT_DRAFT_MW),
    hypocenterKm: Math.round(traceLengthKm(faults, faultId) / 2),
    depthKm: Math.round((source.upperDepthKm + source.lowerDepthKm) / 2),
    seed: 1,
  };
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Keeps a draft inside its fault's limits: magnitude range, hypocentre on the trace, depth in
 * the seismogenic layer. A fault picked on the map keeps the other values where they fit.
 */
export function normalizeDraft(draft: ScenarioDraft, faults: Faults): ScenarioDraft {
  const fault = faults.features.find((f) => f.properties.id === draft.faultId);
  const source = faultSource(faults, draft.faultId);
  const range = fault ? magnitudeRange(fault) : { min: MIN_DRAFT_MW, max: draft.mw };
  return {
    ...draft,
    mw: clamp(draft.mw, range.min, range.max),
    hypocenterKm: clamp(draft.hypocenterKm, 0, Math.round(traceLengthKm(faults, draft.faultId))),
    depthKm: clamp(draft.depthKm, Math.ceil(source.upperDepthKm), Math.floor(source.lowerDepthKm)),
  };
}

/**
 * Turns a draft into a scenario: no extent is given, so the engine sizes the rupture from the
 * Wells and Coppersmith (1994) median area for the magnitude, centred on the hypocentre.
 */
export function customScenario(draft: ScenarioDraft, faults: Faults): Scenario {
  const { faultId, mw, hypocenterKm, depthKm, seed } = normalizeDraft(draft, faults);
  return {
    id: CUSTOM_SCENARIO_ID,
    rupture: {
      fault: faultSource(faults, faultId),
      hypocenterKm,
      hypocenterDepthKm: depthKm,
      mw,
    },
    seed,
  };
}
