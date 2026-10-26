import type { FacilityDamage, VulnerabilityFunction } from '@/types/damage';

import { expectedRatio } from './vulnerability';

export interface FacilitySite {
  id: string;
  lon: number;
  lat: number;
  sArrivalS: number;
  /** Median ground motion at the site in the function's intensity measure, g; NaN if unknown. */
  level: number;
}

/**
 * Expected structural loss ratio of each facility under one representative class, averaged over
 * the ground-motion variability (`sigmaLn`).
 */
export function facilityDamage(
  sites: readonly FacilitySite[],
  fn: VulnerabilityFunction,
  sigmaLn: number,
): FacilityDamage[] {
  return sites.map(({ level, ...site }) => ({
    ...site,
    lossRatio: Number.isFinite(level) ? expectedRatio(fn.imls, fn.structural, level, sigmaLn) : 0,
  }));
}
