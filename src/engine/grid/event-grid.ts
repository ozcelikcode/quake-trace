import type { GridSpec } from '@/types/grid';

import { asb14LnMedian } from '../gmpe/asb14';
import { combinedMmi } from '../intensity/worden2012';

/**
 * Intensity at the edge of the event grid, and the lowest intensity the map draws
 * (`mmiLookupTable`): weak shaking (MMI III, felt indoors) and above. Cells beyond the edge fall
 * below it, so the shaken area never shows a cut edge. MMI II would need grids of over 1000 km
 * for Mw 7 because ASB14 has no anelastic term and decays slowly far from the source.
 */
export const EDGE_MMI = 3;
/**
 * Site for sizing the grid: the NEHRP C/D boundary (BSSC, 2020). Softer sites amplify motion,
 * so sizing on rock would leave stiff-soil edges above `EDGE_MMI`.
 */
const REFERENCE_VS30 = 360;
/** Upper bound of the search; ASB14 is extrapolated beyond its 200 km range here. */
const MAX_RADIUS_KM = 1500;
const MIN_RADIUS_KM = 40;
const KM_PER_DEGREE_LAT = 111.195;
/** Finest cell, about 1 km: the resolution of the regional data. */
const MIN_CELL_KM = 1;

/**
 * Joyner–Boore distance at which the median ASB14 motion (Akkar, Sandıkkaya and Bommer, 2014)
 * on stiff soil gives `EDGE_MMI` through the Worden et al. (2012) conversion. Intensity falls
 * monotonically with distance, so the distance is found by bisection.
 */
export function shakingRadiusKm(mw: number, rakeDeg: number): number {
  const mmiAt = (rjbKm: number) => {
    const motion = { mw, rjbKm, vs30: REFERENCE_VS30, rakeDeg };
    return combinedMmi(
      Math.exp(asb14LnMedian('PGA', motion)),
      Math.exp(asb14LnMedian('PGV', motion)),
    );
  };
  if (mmiAt(MAX_RADIUS_KM) >= EDGE_MMI) return MAX_RADIUS_KM;
  let low = 0;
  let high = MAX_RADIUS_KM;
  for (let i = 0; i < 40; i++) {
    const middle = (low + high) / 2;
    if (mmiAt(middle) >= EDGE_MMI) low = middle;
    else high = middle;
  }
  return Math.max(MIN_RADIUS_KM, high);
}

/**
 * A north-up grid around a rupture: the surface projection's bounding box widened by the
 * shaking radius on every side, with square cells sized so the grid holds about `maxCells`
 * cells (never finer than about 1 km). Longitude steps are widened by 1/cos(latitude) so cells are
 * roughly square on the ground.
 */
export function eventGrid(
  surface: readonly (readonly [number, number])[],
  radiusKm: number,
  maxCells: number,
): GridSpec {
  let west = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  let south = Number.POSITIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;
  for (const [lon, lat] of surface) {
    west = Math.min(west, lon);
    east = Math.max(east, lon);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  const marginLat = radiusKm / KM_PER_DEGREE_LAT;
  north = Math.min(85, north + marginLat);
  south = Math.max(-85, south - marginLat);
  // A degree of longitude is shortest on the poleward edge, which therefore sets the margin
  // that keeps every edge at least R from the rupture.
  const poleward = Math.max(Math.abs(north), Math.abs(south));
  const marginLon = radiusKm / (KM_PER_DEGREE_LAT * Math.cos((poleward * Math.PI) / 180));
  west -= marginLon;
  east += marginLon;

  const meanCos = Math.cos((((north + south) / 2) * Math.PI) / 180);
  const widthKm = (east - west) * KM_PER_DEGREE_LAT * meanCos;
  const heightKm = (north - south) * KM_PER_DEGREE_LAT;
  const cellKm = Math.max(MIN_CELL_KM, Math.sqrt((widthKm * heightKm) / maxCells));
  const dLat = cellKm / KM_PER_DEGREE_LAT;
  const dLon = cellKm / (KM_PER_DEGREE_LAT * meanCos);
  const nx = Math.max(2, Math.ceil((east - west) / dLon));
  const ny = Math.max(2, Math.ceil((north - south) / dLat));
  return { west, north, dLon, dLat, nx, ny };
}
