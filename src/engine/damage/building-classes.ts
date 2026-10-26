import type { BuildingPeriods, BuildingStoreys } from '@/types/damage';

/**
 * Mapping of the district building stock (İBB 2017 classes) onto GEM Türkiye vulnerability
 * classes, all reinforced-concrete infilled frames (CR/LFINF), the dominant residential system:
 *
 * - Construction period → design code level, following the Turkish seismic codes in force:
 *   before 1980 low code (CDL+ERL); 1980–2000, under the 1975 code, moderate code with low
 *   earthquake resistance (CDM+ERL); after 2000, under the 1998 and later codes (CDM+ERM).
 *   This mapping is a modelling judgement, not taken from the GEM exposure model.
 * - Storeys (İBB bins 1–4, 5–9, 9–19) → GEM heights 3, 6 and 10.
 *
 * Periods and storeys are only known as separate counts, so classes assume they are
 * independent within a district.
 */
const PERIOD_CODES: Record<keyof BuildingPeriods, string> = {
  before1980: 'CDL+ERL',
  from1980To2000: 'CDM+ERL',
  after2000: 'CDM+ERM',
};

const STOREY_HEIGHTS: Record<keyof BuildingStoreys, number> = {
  low: 3,
  mid: 6,
  high: 10,
};

/** Representative class for critical facilities (hospitals, fire stations, police). */
export const FACILITY_TAXONOMY = 'CR/LFINF/CDM+ERM/H:3/COM';

export function residentialTaxonomy(
  period: keyof BuildingPeriods,
  storeys: keyof BuildingStoreys,
): string {
  return `CR/LFINF/${PERIOD_CODES[period]}/H:${String(STOREY_HEIGHTS[storeys])}/RES`;
}

export interface ClassShare {
  taxonomy: string;
  share: number;
}

/** Share of each class in a district's stock under the independence assumption. */
export function classShares(byPeriod: BuildingPeriods, byStoreys: BuildingStoreys): ClassShare[] {
  const periodTotal = byPeriod.before1980 + byPeriod.from1980To2000 + byPeriod.after2000;
  const storeyTotal = byStoreys.low + byStoreys.mid + byStoreys.high;
  if (periodTotal <= 0 || storeyTotal <= 0) return [];
  const shares: ClassShare[] = [];
  for (const period of Object.keys(PERIOD_CODES) as (keyof BuildingPeriods)[]) {
    for (const storeys of Object.keys(STOREY_HEIGHTS) as (keyof BuildingStoreys)[]) {
      const share = (byPeriod[period] / periodTotal) * (byStoreys[storeys] / storeyTotal);
      if (share > 0) shares.push({ taxonomy: residentialTaxonomy(period, storeys), share });
    }
  }
  return shares;
}
