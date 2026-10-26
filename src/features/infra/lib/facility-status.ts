import { FACILITY_LIMITED_FROM, FACILITY_OUT_OF_SERVICE_FROM } from '@/types/damage';

/**
 * Operational state of a critical facility from the expected structural loss ratio of its
 * building class (thresholds in `types/damage.ts`).
 */
export type FacilityStatus = 'pending' | 'operational' | 'limited' | 'outOfService';

/** `pending` until the S wave has reached the facility. */
export function facilityStatus(
  lossRatio: number,
  sArrivalS: number,
  timeS: number,
): FacilityStatus {
  if (timeS < sArrivalS) return 'pending';
  if (lossRatio >= FACILITY_OUT_OF_SERVICE_FROM) return 'outOfService';
  return lossRatio >= FACILITY_LIMITED_FROM ? 'limited' : 'operational';
}
