import type { VulnerabilityFunction } from '@/types/damage';
import type { GridSpec } from '@/types/grid';
import type { NetworkResult } from '@/types/network';

import { expectedRatio } from '../damage/vulnerability';
import { DEMAND_DECAY_S, peakDemand } from './call-demand';
import { serviceAreas } from './service-areas';
import { syntheticSites } from './synthetic-sites';

export interface NetworkInput {
  grid: GridSpec;
  /** Land mask: NaN outside the region's districts. */
  land: Float32Array;
  population: Float32Array;
  /** Settlement class per cell (`grid/settlement.ts`), for synthetic sites. */
  settlement: Uint8Array;
  /** Real sites [lon0, lat0, ...]; synthetic sites are generated when absent. */
  siteLonLat?: Float32Array | undefined;
  tS: Float32Array;
  mmi: Float32Array;
  /** Host-building class and its median intensity measure per cell, g. */
  hostFunction: VulnerabilityFunction;
  hostLevel: Float32Array;
  hostSigmaLn: number;
}

/**
 * Cell sites with their service population, S-wave arrival, demand surge (`call-demand.ts`) and
 * host-building loss. Sites are taken as installed on low-rise commercial concrete buildings,
 * the facility class of the damage estimate; power cuts and battery autonomy are not modelled.
 */
export function cellNetwork(input: NetworkInput): NetworkResult {
  const { grid } = input;
  const synthetic = !input.siteLonLat;
  const siteLonLat = Float32Array.from(
    input.siteLonLat ?? syntheticSites(grid, input.settlement, input.land),
  );
  const siteCount = siteLonLat.length / 2;
  const areas = serviceAreas(grid, siteLonLat, input.land, input.population);

  const siteSArrivalS = new Float32Array(siteCount);
  const sitePeakDemand = new Float32Array(siteCount);
  const siteLossRatio = new Float32Array(siteCount);
  // Sites in one cell share its shaking, so the loss ratio is computed once per cell.
  const lossByCell = new Map<number, number>();
  for (let site = 0; site < siteCount; site++) {
    const cell = areas.siteCell[site] ?? -1;
    if (cell < 0) {
      siteSArrivalS[site] = Number.POSITIVE_INFINITY;
      sitePeakDemand[site] = 1;
      continue;
    }
    siteSArrivalS[site] = input.tS[cell] ?? Number.POSITIVE_INFINITY;
    sitePeakDemand[site] = peakDemand(input.mmi[cell] ?? 0);
    let loss = lossByCell.get(cell);
    if (loss === undefined) {
      const level = input.hostLevel[cell] ?? 0;
      const { imls, structural } = input.hostFunction;
      loss = level > 0 ? expectedRatio(imls, structural, level, input.hostSigmaLn) : 0;
      lossByCell.set(cell, loss);
    }
    siteLossRatio[site] = loss;
  }

  return {
    synthetic,
    siteCount,
    siteLonLat,
    sitePopulation: areas.sitePopulation,
    siteDensity: areas.siteDensity,
    siteSArrivalS,
    sitePeakDemand,
    siteLossRatio,
    cellSite: areas.cellSite,
    decayS: DEMAND_DECAY_S,
  };
}
