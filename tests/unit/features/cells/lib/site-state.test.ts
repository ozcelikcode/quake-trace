import { describe, expect, it } from 'vitest';

import {
  blockedDensity,
  siteDemand,
  siteState,
  summarizeNetwork,
} from '@/features/cells/lib/site-state';
import type { NetworkResult } from '@/types/network';

// Site 0 shaken hard, site 1 barely, site 2 with a likely-out host building.
const network: NetworkResult = {
  synthetic: true,
  siteCount: 3,
  siteLonLat: new Float32Array(6),
  sitePopulation: Float32Array.from([1000, 500, 200]),
  siteDensity: Float32Array.from([4000, 100, 800]),
  siteSArrivalS: Float32Array.from([10, 20, 10]),
  sitePeakDemand: Float32Array.from([55, 1, 55]),
  siteLossRatio: Float32Array.from([0, 0, 0.3]),
  cellSite: new Int32Array(0),
  decayS: 1000,
};

describe('cell site demand and state', () => {
  it('is normal before the S wave, peaks on arrival and decays exponentially', () => {
    expect(siteDemand(network, 0, 9.9)).toBe(1);
    expect(siteDemand(network, 0, 10)).toBe(55);
    expect(siteDemand(network, 0, 1010)).toBeCloseTo(1 + 54 * Math.exp(-1), 9);
  });

  it('is pending, congested, normal or down', () => {
    expect(siteState(network, 0, 5)).toBe('pending');
    expect(siteState(network, 0, 10)).toBe('congested');
    expect(siteState(network, 1, 30)).toBe('normal');
    expect(siteState(network, 2, 10)).toBe('down');
  });

  it('gives the density of residents whose calls are not carried', () => {
    expect(blockedDensity(network, 0, 5)).toBe(0);
    expect(blockedDensity(network, 0, 10)).toBeCloseTo(4000 * (1 - 1 / 55), 9);
    expect(blockedDensity(network, 1, 30)).toBe(0);
    expect(blockedDensity(network, 2, 10)).toBe(800);
  });

  it('counts sites and residents by state and the share of calls not carried', () => {
    const summary = summarizeNetwork(network, 15);
    expect(summary.sites).toEqual({ pending: 1, normal: 0, congested: 1, down: 1 });
    expect(summary.residents.congested).toBe(1000);
    const demand = siteDemand(network, 0, 15);
    const attempts = 1000 * demand + 200 * siteDemand(network, 2, 15);
    const blocked = 1000 * (demand - 1) + 200 * siteDemand(network, 2, 15);
    expect(summary.blockedShare).toBeCloseTo(blocked / attempts, 12);
  });
});
