/**
 * Call demand on a cell site after an earthquake, relative to its normal busy hour.
 *
 * - Peak: voice traffic surged to 50–60 times normal levels after the 2011 Tōhoku earthquake
 *   (NTT DOCOMO, Annual Report 2011, "Restrictions on Transmission"); the midpoint is used.
 * - Who calls: the share of people who felt the shaking, rising linearly from intensity II
 *   ("felt only by a few persons at rest") to VI ("felt by all") in the USGS abridged Modified
 *   Mercalli scale. The linear rise is an assumption.
 * - Timing: emergencies witnessed by the population raise call volume without delay and it
 *   starts decaying immediately; the anomaly after an earthquake lasted 1.42 h (Bagrow, Wang and
 *   Barabási, 2011, PLoS ONE 6(3): e17680, Fig. 1 and Table 1). The excess decays exponentially
 *   and falls to 5 % (three e-folding times) when that anomaly ends; the shape is an assumption.
 */

export const PEAK_DEMAND = 55;
const FELT_FROM_MMI = 2;
const FELT_BY_ALL_MMI = 6;
const ANOMALY_DURATION_S = 1.42 * 3600;
export const DEMAND_DECAY_S = ANOMALY_DURATION_S / 3;

/** Share of residents who felt shaking of intensity `mmi`, 0–1. */
export function feltShare(mmi: number): number {
  return Math.min(1, Math.max(0, (mmi - FELT_FROM_MMI) / (FELT_BY_ALL_MMI - FELT_FROM_MMI)));
}

/** Demand right after the shaking at intensity `mmi`, relative to the normal busy hour. */
export function peakDemand(mmi: number): number {
  return 1 + (PEAK_DEMAND - 1) * feltShare(mmi);
}
