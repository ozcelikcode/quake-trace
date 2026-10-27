import { describe, expect, it } from 'vitest';

import {
  isVirtualStation,
  recordingSites,
  scenarioEpicentre,
} from '@/features/scenario/lib/virtual-stations';
import { haversineKm } from '@/lib/math/geo';
import type { Scenario } from '@/types/scenario';

const scenario = (lon: number): Scenario => ({
  id: 'test',
  rupture: {
    fault: {
      id: 'F',
      trace: [
        [lon, 40],
        [lon + 1, 40],
      ],
      dipDeg: 90,
      rakeDeg: 180,
      upperDepthKm: 0,
      lowerDepthKm: 15,
    },
    hypocenterKm: 0,
    hypocenterDepthKm: 10,
    mw: 7,
  },
  seed: 1,
});

const network = Array.from({ length: 10 }, (_, i) => ({
  id: `KO.S${String(i)}`,
  lon: 29 + i * 0.1,
  lat: 40.1,
}));

describe('recording sites', () => {
  it('uses the real network where it covers the epicentre', () => {
    const sites = recordingSites(scenario(29), network);
    expect(sites).toHaveLength(10);
    expect(sites.some((site) => isVirtualStation(site.id))).toBe(false);
  });

  it('adds a labelled ring of virtual stations elsewhere and drops distant real ones', () => {
    const sites = recordingSites(scenario(140), network);
    expect(sites).toHaveLength(12);
    const [lon, lat] = scenarioEpicentre(scenario(140));
    for (const site of sites) {
      expect(isVirtualStation(site.id)).toBe(true);
      expect(haversineKm(lon, lat, site.lon, site.lat)).toBeLessThanOrEqual(100.1);
    }
  });
});
