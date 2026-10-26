import type { ScenarioEvent } from '@/types/scenario';

/**
 * Historical Marmara earthquakes for replay, with origin, magnitude and hypocentre from the USGS
 * ComCat catalog (event ids below; recorded in tests/fixtures/feeds/usgs-events.json on
 * 2026-10-26). The 1999 rupture keeps the extent of the İzmit preset (Gölcük to Gölyaka along
 * the North Anatolian Fault); the others are sized from their magnitude on the nearest fault.
 */
export const HISTORICAL_EVENTS = [
  {
    id: 'replay-kocaeli-1999',
    originMs: Date.UTC(1999, 7, 17, 0, 1, 39, 130),
    lon: 29.864,
    lat: 40.748,
    depthKm: 17,
    magnitude: 7.6,
    place: 'Kocaeli (Gölcük)',
    catalog: 'USGS usp0009d4z',
    extentLon: [30.9, 29.35],
  },
  {
    id: 'replay-silivri-2019',
    originMs: Date.UTC(2019, 8, 26, 10, 59, 25, 648),
    lon: 28.1502,
    lat: 40.9035,
    depthKm: 8,
    magnitude: 5.7,
    place: 'Silivri açıkları',
    catalog: 'USGS us70005lkl',
  },
  {
    id: 'replay-marmara-2025',
    originMs: Date.UTC(2025, 3, 23, 9, 49, 11, 631),
    lon: 28.1897,
    lat: 40.8342,
    depthKm: 12.7,
    magnitude: 6.2,
    place: 'Marmara Ereğlisi – Silivri açıkları',
    catalog: 'USGS us7000pufs',
  },
] as const satisfies readonly ScenarioEvent[];

export type HistoricalEventId = (typeof HISTORICAL_EVENTS)[number]['id'];
