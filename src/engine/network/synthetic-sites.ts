import type { GridSpec } from '@/types/grid';

import { cellAreaKm2 } from '../grid/settlement';
import { createRandom } from '../random/random';

/**
 * Synthetic cell sites, used when no OpenCelliD data was built. Each land cell receives the
 * site density of a hexagonal macro-cell layout at the inter-site distance (ISD) of its
 * settlement class, taken from the IMT-Advanced test environments (Report ITU-R M.2135-1, 2009,
 * Table 8-4): urban macro 500 m for urban centres, suburban macro 1,299 m for urban clusters,
 * rural macro 1,732 m elsewhere. A hexagonal site covers (√3/2)·ISD².
 *
 * Sites are scattered uniformly inside their cell from a fixed seed, so every scenario sees the
 * same network. A planning-level stand-in, not the operators' real sites.
 */

const RURAL_ISD_KM = 1.732;
/** ISD by settlement class, in `SETTLEMENT` order (rural, cluster, centre). */
const ISD_KM = [RURAL_ISD_KM, 1.299, 0.5] as const;
/** Fixed seed of the synthetic layout, independent of the scenario seed. */
export const SYNTHETIC_SITE_SEED = 286;

export function siteAreaKm2(isdKm: number): number {
  return (Math.sqrt(3) / 2) * isdKm * isdKm;
}

/**
 * Interleaved site coordinates [lon0, lat0, ...] for every cell where `land` is not NaN.
 * The expected count per cell is area / site area; the fractional part is drawn.
 */
export function syntheticSites(
  spec: GridSpec,
  settlement: Uint8Array,
  land: Float32Array,
  seed = SYNTHETIC_SITE_SEED,
): Float32Array {
  const random = createRandom(seed);
  const coordinates: number[] = [];
  for (let row = 0; row < spec.ny; row++) {
    const area = cellAreaKm2(spec, row);
    for (let col = 0; col < spec.nx; col++) {
      const cell = row * spec.nx + col;
      if (Number.isNaN(land[cell] ?? Number.NaN)) continue;
      const isd = ISD_KM[settlement[cell] ?? 0] ?? RURAL_ISD_KM;
      const expected = area / siteAreaKm2(isd);
      const count = Math.floor(expected) + (random.next() < expected % 1 ? 1 : 0);
      for (let i = 0; i < count; i++) {
        coordinates.push(
          spec.west + (col + random.next()) * spec.dLon,
          spec.north - (row + random.next()) * spec.dLat,
        );
      }
    }
  }
  return Float32Array.from(coordinates);
}
