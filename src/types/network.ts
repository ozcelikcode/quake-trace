/**
 * Cell sites of a scenario and the parameters of their call demand. Demand is relative to the
 * site's normal busy hour, for which the site is dimensioned, so a value above 1 means
 * congestion. At time t after the S-wave arrival tS at a site:
 * demand(t) = 1 + (peakDemand − 1) · exp(−(t − tS) / decayS); before tS it is 1.
 */
export interface NetworkResult {
  /** True when the sites are synthetic (no OpenCelliD data was built). */
  synthetic: boolean;
  siteCount: number;
  /** Interleaved [lon0, lat0, lon1, lat1, ...]. */
  siteLonLat: Float32Array<ArrayBuffer>;
  /** Residents in each site's service area. */
  sitePopulation: Float32Array<ArrayBuffer>;
  /** Residents per km² of each site's service area. */
  siteDensity: Float32Array<ArrayBuffer>;
  /** S-wave arrival at each site's grid cell, s after origin. */
  siteSArrivalS: Float32Array<ArrayBuffer>;
  /** Demand right after the shaking, relative to the normal busy hour. */
  sitePeakDemand: Float32Array<ArrayBuffer>;
  /** Expected structural loss ratio of the site's host building. */
  siteLossRatio: Float32Array<ArrayBuffer>;
  /** Serving site of each grid cell, -1 where no site serves the cell. */
  cellSite: Int32Array<ArrayBuffer>;
  /** e-folding time of the demand surge, s. */
  decayS: number;
}

/**
 * Display state of a site at a time: pending before the S wave, down when its host building is
 * likely out of service, congested when demand exceeds the busy-hour capacity.
 */
export type SiteState = 'pending' | 'normal' | 'congested' | 'down';
