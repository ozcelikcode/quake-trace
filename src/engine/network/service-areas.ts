import type { GridSpec } from '@/types/grid';

import { cellAreaKm2 } from '../grid/settlement';
import { PointIndex } from '../grid/point-index';

/**
 * Service areas of cell sites on the grid, a raster approximation of their Voronoi cells: each
 * land cell is served by the site nearest to its centre, and its residents are shared evenly
 * among the sites inside it (or all go to the nearest site when it has none).
 */
export interface ServiceAreas {
  /** Serving site per grid cell, -1 outside the land mask or out of reach. */
  cellSite: Int32Array<ArrayBuffer>;
  sitePopulation: Float32Array<ArrayBuffer>;
  /** Residents per km² of each site's service area. */
  siteDensity: Float32Array<ArrayBuffer>;
  /** Grid cell of each site, -1 outside the grid. */
  siteCell: Int32Array<ArrayBuffer>;
}

/** Search radius for cells without a site, in cells (rural spacing is under 2 km). */
const MAX_RING = 12;

export function serviceAreas(
  spec: GridSpec,
  siteLonLat: Float32Array,
  land: Float32Array,
  population: Float32Array,
): ServiceAreas {
  const index = new PointIndex(spec, siteLonLat);
  const cellSite = new Int32Array(spec.nx * spec.ny).fill(-1);
  const sitePopulation = new Float32Array(siteLonLat.length / 2);
  const siteArea = new Float32Array(siteLonLat.length / 2);
  for (let row = 0; row < spec.ny; row++) {
    const lat = spec.north - (row + 0.5) * spec.dLat;
    const area = cellAreaKm2(spec, row);
    for (let col = 0; col < spec.nx; col++) {
      const cell = row * spec.nx + col;
      if (Number.isNaN(land[cell] ?? Number.NaN)) continue;
      const site = index.nearest(spec.west + (col + 0.5) * spec.dLon, lat, MAX_RING);
      cellSite[cell] = site;
      const people = Math.max(0, population[cell] ?? 0);
      const inside = index.countIn(cell);
      if (inside > 0) {
        for (const own of index.pointsIn(cell)) {
          sitePopulation[own] = (sitePopulation[own] ?? 0) + people / inside;
          siteArea[own] = (siteArea[own] ?? 0) + area / inside;
        }
      } else if (site >= 0) {
        sitePopulation[site] = (sitePopulation[site] ?? 0) + people;
        siteArea[site] = (siteArea[site] ?? 0) + area;
      }
    }
  }
  const siteDensity = Float32Array.from(sitePopulation, (people, site) => {
    const area = siteArea[site] ?? 0;
    return area > 0 ? people / area : 0;
  });
  return { cellSite, sitePopulation, siteDensity, siteCell: Int32Array.from(index.pointCell) };
}
