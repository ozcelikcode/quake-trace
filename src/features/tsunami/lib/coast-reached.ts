import type { CoastalTsunami } from '@/types/tsunami';

/** Coastal districts the wave has reached by `timeS`, in order of arrival. */
export function coastReached(coast: readonly CoastalTsunami[], timeS: number): CoastalTsunami[] {
  return coast.filter((entry) => entry.arrivalS <= timeS).sort((a, b) => a.arrivalS - b.arrivalS);
}

/** The district with the highest coastal wave, if any. */
export function highestCoast(coast: readonly CoastalTsunami[]): CoastalTsunami | undefined {
  return coast.reduce<CoastalTsunami | undefined>(
    (best, entry) => (entry.maxEtaM > (best?.maxEtaM ?? Number.NEGATIVE_INFINITY) ? entry : best),
    undefined,
  );
}
