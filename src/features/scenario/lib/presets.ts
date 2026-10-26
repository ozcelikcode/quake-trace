import { faultSource } from '@/data/fault-source';
import type { Faults } from '@/data/schemas';
import { cumulativeLengthsKm, kmAtLongitude } from '@/lib/math/polyline';
import type { Scenario } from '@/types/scenario';

/**
 * Preset ruptures on the Main Marmara Fault (EFSM20 source TRCF045, the northern strand of the
 * North Anatolian Fault, digitized east to west). Extents are given as longitudes along the
 * trace; segment names follow common usage in the literature (e.g. Le Pichon et al., 2001;
 * Armijo et al., 2002) and their limits are approximate. Magnitudes are derived from the
 * rupture area (Wells and Coppersmith, 1994).
 */
export interface ScenarioPreset {
  id: PresetId;
  faultId: string;
  fromLon: number;
  toLon: number;
  hypocenterLon: number;
  hypocenterDepthKm: number;
}

export type PresetId = 'north-marmara' | 'kumburgaz' | 'princes-islands' | 'izmit-1999';

const MAIN_MARMARA_FAULT = 'TRCF045';
/** Presets use a fixed seed, so every run of a preset produces the same records. */
const PRESET_SEED = 1;

export const SCENARIO_PRESETS: readonly ScenarioPreset[] = [
  {
    // The seismic gap between the 1912 Mürefte and 1999 İzmit ruptures.
    id: 'north-marmara',
    faultId: MAIN_MARMARA_FAULT,
    fromLon: 29.15,
    toLon: 27.75,
    hypocenterLon: 28.25,
    hypocenterDepthKm: 12,
  },
  {
    id: 'kumburgaz',
    faultId: MAIN_MARMARA_FAULT,
    fromLon: 28.95,
    toLon: 28.45,
    hypocenterLon: 28.7,
    hypocenterDepthKm: 12,
  },
  {
    id: 'princes-islands',
    faultId: MAIN_MARMARA_FAULT,
    fromLon: 29.25,
    toLon: 28.85,
    hypocenterLon: 29.05,
    hypocenterDepthKm: 10,
  },
  {
    // Extent and hypocentre after the 17 August 1999 İzmit (Kocaeli) earthquake.
    id: 'izmit-1999',
    faultId: MAIN_MARMARA_FAULT,
    fromLon: 30.9,
    toLon: 29.35,
    hypocenterLon: 29.9,
    hypocenterDepthKm: 15,
  },
];

export class PresetError extends Error {
  override name = 'PresetError';
}

/** Turns a preset into a scenario on the prepared fault geometry. */
export function resolvePreset(preset: ScenarioPreset, faults: Faults): Scenario {
  const fault = faultSource(faults, preset.faultId);
  const cumulative = cumulativeLengthsKm(fault.trace);
  const at = (lon: number) => {
    const km = kmAtLongitude(fault.trace, cumulative, lon);
    if (km === undefined)
      throw new PresetError(`fault ${fault.id} does not reach ${String(lon)}°E`);
    return km;
  };
  const from = at(preset.fromLon);
  const to = at(preset.toLon);
  return {
    id: preset.id,
    rupture: {
      fault,
      startKm: Math.min(from, to),
      endKm: Math.max(from, to),
      hypocenterKm: at(preset.hypocenterLon),
      hypocenterDepthKm: preset.hypocenterDepthKm,
    },
    seed: PRESET_SEED,
  };
}
