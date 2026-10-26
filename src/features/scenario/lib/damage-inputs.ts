import type { DistrictStats, Infra, Vulnerability } from '@/data/schemas';
import {
  CRITICAL_FACILITY_KINDS,
  type CriticalFacilityKind,
  type DamageInputs,
} from '@/types/damage';

function isCriticalKind(kind: string): kind is CriticalFacilityKind {
  return (CRITICAL_FACILITY_KINDS as readonly string[]).includes(kind);
}

/** Prepared datasets in the shape the damage estimate takes. */
export function damageInputs(
  stats: DistrictStats,
  vulnerability: Vulnerability,
  population: Float32Array,
  infra: Infra,
): DamageInputs {
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
      const { kind, id } = feature.properties;
      if (feature.geometry.type !== 'Point' || !isCriticalKind(kind)) return [];
      const [lon, lat] = feature.geometry.coordinates;
      return [{ id, kind, lon, lat }];
    }),
  };
}
