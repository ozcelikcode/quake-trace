/** Intensity measures used by the vulnerability functions, in g. */
export type SpectralMeasure = 'PGA' | 'SA(0.3)' | 'SA(0.6)' | 'SA(1.0)';

/** Building and fatality vulnerability for one building class (GEM taxonomy string). */
export interface VulnerabilityFunction {
  taxonomy: string;
  imt: SpectralMeasure;
  imls: number[];
  /** Mean structural loss ratio at each level. */
  structural: number[];
  /** Mean fatality ratio per occupant at each level. */
  fatality: number[];
}

export interface BuildingPeriods {
  before1980: number;
  from1980To2000: number;
  after2000: number;
}

export interface BuildingStoreys {
  low: number;
  mid: number;
  high: number;
}

/** Building stock and residents of one district (index into districts.geojson). */
export interface DistrictStock {
  index: number;
  population: number;
  buildings: { total: number; byPeriod: BuildingPeriods; byStoreys: BuildingStoreys };
  /** True when the stock is estimated rather than counted (outside İstanbul). */
  estimated: boolean;
}

export interface DistrictDamage {
  index: number;
  buildings: number;
  /** Mean structural loss ratio over the district's buildings. */
  lossRatio: number;
  /** Buildings equivalent to complete loss: Σ buildings × loss ratio. */
  buildingsLost: number;
  /** Expected fatalities with residents at home (night). */
  fatalities: number;
  estimated: boolean;
}

/** Facility kinds whose building damage matters for the response. */
export const CRITICAL_FACILITY_KINDS = ['hospital', 'fireStation', 'police'] as const;
export type CriticalFacilityKind = (typeof CRITICAL_FACILITY_KINDS)[number];

export interface CriticalFacility {
  id: string;
  kind: CriticalFacilityKind;
  lon: number;
  lat: number;
}

/**
 * Loss-ratio thresholds of a facility's display state. A modelling assumption, not a published
 * functionality model: below 5 % the building is taken as usable, from 20 % as likely out of
 * service. The same out-of-service threshold removes hospitals and fire stations from routing.
 */
export const FACILITY_LIMITED_FROM = 0.05;
export const FACILITY_OUT_OF_SERVICE_FROM = 0.2;

/** A critical facility with its expected structural loss ratio at the site. */
export interface FacilityDamage {
  id: string;
  kind: CriticalFacilityKind;
  lon: number;
  lat: number;
  lossRatio: number;
  /** S-wave arrival at the facility's grid cell, s after origin. */
  sArrivalS: number;
}

/** Inputs of the damage estimate, passed with a scenario. */
export interface DamageInputs {
  stock: readonly DistrictStock[];
  functions: readonly VulnerabilityFunction[];
  /** Residents per grid cell. */
  population: Float32Array;
  facilities: readonly CriticalFacility[];
}
