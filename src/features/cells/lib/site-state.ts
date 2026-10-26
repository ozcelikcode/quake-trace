import { FACILITY_OUT_OF_SERVICE_FROM } from '@/types/damage';
import type { NetworkResult, SiteState } from '@/types/network';

/** Call demand on a site at `timeS`, relative to its busy hour (model in `types/network.ts`). */
export function siteDemand(network: NetworkResult, site: number, timeS: number): number {
  const arrival = network.siteSArrivalS[site] ?? Number.POSITIVE_INFINITY;
  if (timeS < arrival) return 1;
  const peak = network.sitePeakDemand[site] ?? 1;
  return 1 + (peak - 1) * Math.exp(-(timeS - arrival) / network.decayS);
}

export function siteState(network: NetworkResult, site: number, timeS: number): SiteState {
  if (timeS < (network.siteSArrivalS[site] ?? Number.POSITIVE_INFINITY)) return 'pending';
  if ((network.siteLossRatio[site] ?? 0) >= FACILITY_OUT_OF_SERVICE_FROM) return 'down';
  return siteDemand(network, site, timeS) > 1 ? 'congested' : 'normal';
}

/** Share of a site's call attempts it cannot carry: 1 − 1/demand, or all when down. */
export function blockedShare(network: NetworkResult, site: number, timeS: number): number {
  const state = siteState(network, site, timeS);
  if (state === 'pending') return 0;
  if (state === 'down') return 1;
  return 1 - 1 / siteDemand(network, site, timeS);
}

/** Residents per km² whose calls cannot be carried, in a site's service area. */
export function blockedDensity(network: NetworkResult, site: number, timeS: number): number {
  return (network.siteDensity[site] ?? 0) * blockedShare(network, site, timeS);
}

export interface NetworkSummary {
  sites: Record<SiteState, number>;
  residents: Record<SiteState, number>;
  /**
   * Share of call attempts that cannot be carried on the reached sites: each site carries its
   * busy-hour load, so a site at demand d blocks 1 − 1/d of its attempts; a down site blocks all.
   */
  blockedShare: number;
}

export function summarizeNetwork(network: NetworkResult, timeS: number): NetworkSummary {
  const sites = { pending: 0, normal: 0, congested: 0, down: 0 };
  const residents = { pending: 0, normal: 0, congested: 0, down: 0 };
  let attempts = 0;
  let blocked = 0;
  for (let site = 0; site < network.siteCount; site++) {
    const state = siteState(network, site, timeS);
    const people = network.sitePopulation[site] ?? 0;
    sites[state]++;
    residents[state] += people;
    if (state === 'pending') continue;
    const demand = siteDemand(network, site, timeS);
    attempts += people * demand;
    blocked += people * demand * blockedShare(network, site, timeS);
  }
  return { sites, residents, blockedShare: attempts > 0 ? blocked / attempts : 0 };
}
