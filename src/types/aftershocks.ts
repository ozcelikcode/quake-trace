/** A synthetic aftershock sequence, events sorted by time. */
export interface AftershockCatalog {
  durationS: number;
  /** Smallest magnitude in the catalog. */
  minMagnitude: number;
  count: number;
  timeS: Float32Array<ArrayBuffer>;
  lon: Float32Array<ArrayBuffer>;
  lat: Float32Array<ArrayBuffer>;
  depthKm: Float32Array<ArrayBuffer>;
  magnitude: Float32Array<ArrayBuffer>;
  /**
   * Forecast at each whole hour h (index h, 0 … duration): probability of at least one
   * aftershock of magnitude ≥ 5 and ≥ 6 in the following 24 hours.
   */
  forecastStepS: number;
  forecastM5: Float32Array<ArrayBuffer>;
  forecastM6: Float32Array<ArrayBuffer>;
}
