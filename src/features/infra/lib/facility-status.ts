/**
 * Operational state of a critical facility from the expected structural loss ratio of its
 * building class. The thresholds are a modelling assumption for display, not a published
 * functionality model: below 5 % the building is taken as usable, from 20 % as likely out of
 * service.
 */
export type FacilityStatus = 'pending' | 'operational' | 'limited' | 'outOfService';

export const LIMITED_FROM = 0.05;
export const OUT_OF_SERVICE_FROM = 0.2;

/** `pending` until the S wave has reached the facility. */
export function facilityStatus(
  lossRatio: number,
  sArrivalS: number,
  timeS: number,
): FacilityStatus {
  if (timeS < sArrivalS) return 'pending';
  if (lossRatio >= OUT_OF_SERVICE_FROM) return 'outOfService';
  return lossRatio >= LIMITED_FROM ? 'limited' : 'operational';
}
