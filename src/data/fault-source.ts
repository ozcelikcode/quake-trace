import type { FaultSource, LonLat } from '@/types/scenario';

import { DataError } from './errors';
import type { Faults, WorldFault } from './schemas';

/**
 * The engine's view of an EFSM20 fault: the top-edge trace (the longest part of a multi-line
 * trace) with the average dip and rake. Shared by the scenario feature and the map preview, so
 * both place hypocentres on the same line.
 */
export function faultSource(faults: Faults, faultId: string): FaultSource {
  const feature = faults.features.find((f) => f.properties.id === faultId);
  if (!feature) throw new DataError(`fault ${faultId} is not in the faults dataset`);
  const { geometry, properties } = feature;
  const trace: LonLat[] =
    geometry.type === 'LineString'
      ? geometry.coordinates
      : geometry.coordinates.reduce((longest, part) =>
          part.length > longest.length ? part : longest,
        );
  return {
    id: properties.id,
    trace,
    dipDeg: properties.dipDeg.avg,
    rakeDeg: properties.rakeDeg.avg,
    upperDepthKm: properties.upperDepthKm,
    lowerDepthKm: properties.lowerDepthKm,
  };
}

/** The engine's view of a worldwide fault (EFSM20 or GEM, already ordered by the right-hand rule). */
export function worldFaultSource(fault: WorldFault): FaultSource {
  const { properties } = fault;
  return {
    id: properties.id,
    trace: fault.geometry.coordinates,
    dipDeg: properties.dipDeg,
    rakeDeg: properties.rakeDeg,
    upperDepthKm: properties.upperDepthKm,
    lowerDepthKm: properties.lowerDepthKm,
  };
}
