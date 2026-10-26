import {
  criticalFacilityKinds,
  type DistrictStats,
  type Infra,
  type Vulnerability,
} from '@/data/schemas';
import type { DamageInputs } from '@/types/damage';

/** Prepared datasets in the shape the damage estimate takes. */
export function damageInputs(
  stats: DistrictStats,
  vulnerability: Vulnerability,
  population: Float32Array,
  infra: Infra,
): DamageInputs {
  const kinds: readonly string[] = criticalFacilityKinds;
  return {
    stock: stats.districts.map((district) => ({
      index: district.index,
      population: district.population,
      buildings: district.buildings,
      estimated: district.buildingSource === 'estimated',
    })),
    functions: vulnerability.functions,
    population,
    facilities: infra.features.flatMap((feature) => {
      if (feature.geometry.type !== 'Point' || !kinds.includes(feature.properties.kind)) return [];
      const [lon, lat] = feature.geometry.coordinates;
      return [{ id: feature.properties.id, lon, lat }];
    }),
  };
}
