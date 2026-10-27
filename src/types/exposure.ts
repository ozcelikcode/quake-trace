/** Residents of one province per intensity class (index = MMI class, 0–10). */
export interface ProvinceExposure {
  /** Index into turkey-provinces.json. */
  index: number;
  /** Highest median intensity over the province's populated cells. */
  maxMmi: number;
  populationByMmi: number[];
}

/** Residents per intensity class (index = MMI class, 0–10; classes below III are zero). */
export interface PopulationExposure {
  populationByMmi: number[];
  /** Provinces with exposed residents, strongest shaking first. */
  provinces: ProvinceExposure[];
}
