import { EARTH_RADIUS_KM } from '@/lib/math/geo';
import type { GridSpec } from '@/types/grid';

/**
 * Settlement class of each grid cell from its population density, after the level-1 grid
 * classification of the Degree of Urbanisation (European Commission and Eurostat, 2021,
 * "Applying the Degree of Urbanisation", methodological manual): urban centre cells have at
 * least 1,500 inhabitants per km², urban cluster cells at least 300, the rest are rural. Only the
 * density thresholds are applied, not the contiguity and minimum-population rules.
 */
export const SETTLEMENT = { rural: 0, cluster: 1, centre: 2 } as const;
export type Settlement = (typeof SETTLEMENT)[keyof typeof SETTLEMENT];

const URBAN_CENTRE_DENSITY = 1500;
const URBAN_CLUSTER_DENSITY = 300;

const RAD = Math.PI / 180;

/** Area of a cell in grid row `row`, km², on the sphere. */
export function cellAreaKm2(spec: GridSpec, row: number): number {
  const north = (spec.north - row * spec.dLat) * RAD;
  const south = (spec.north - (row + 1) * spec.dLat) * RAD;
  return EARTH_RADIUS_KM ** 2 * spec.dLon * RAD * (Math.sin(north) - Math.sin(south));
}

export function settlementOf(densityPerKm2: number): Settlement {
  if (densityPerKm2 >= URBAN_CENTRE_DENSITY) return SETTLEMENT.centre;
  return densityPerKm2 >= URBAN_CLUSTER_DENSITY ? SETTLEMENT.cluster : SETTLEMENT.rural;
}

/** Settlement class per cell from residents per cell. */
export function settlementClasses(spec: GridSpec, population: Float32Array): Uint8Array {
  const classes = new Uint8Array(spec.nx * spec.ny);
  for (let row = 0; row < spec.ny; row++) {
    const area = cellAreaKm2(spec, row);
    for (let col = 0; col < spec.nx; col++) {
      const cell = row * spec.nx + col;
      classes[cell] = settlementOf(Math.max(0, population[cell] ?? 0) / area);
    }
  }
  return classes;
}
