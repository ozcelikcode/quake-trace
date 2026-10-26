import { describe, expect, it } from 'vitest';

import type { Station } from '@/data/schemas';
import {
  facilitiesToGeoJson,
  REFERENCE_SOURCES,
  referenceLayerSpecs,
  stationsToGeoJson,
  triangleIcon,
} from '@/features/map/lib/reference-layers';

const station: Station = {
  id: 'KO.ARMT',
  network: 'KO',
  station: 'ARMT',
  lat: 40.57,
  lon: 28.87,
  elevationM: 320,
  depthM: 0,
  channels: ['HNZ'],
  accelerometer: true,
  broadband: false,
  shortPeriod: false,
};

describe('reference layers', () => {
  it('converts stations to GeoJSON points in [lon, lat] order', () => {
    const collection = stationsToGeoJson([station]);
    expect(collection.features[0]?.geometry.coordinates).toEqual([28.87, 40.57]);
    expect(collection.features[0]?.properties).toEqual({ id: 'KO.ARMT', accelerometer: true });
  });

  it('draws districts, faults, stations, then facilities, each on its own source', () => {
    const specs = referenceLayerSpecs('dark');
    expect(specs.map((spec) => spec.type)).toEqual(['line', 'line', 'symbol', 'circle']);
    expect(specs.map((spec) => ('source' in spec ? spec.source : undefined))).toEqual([
      REFERENCE_SOURCES.districts,
      REFERENCE_SOURCES.faults,
      REFERENCE_SOURCES.stations,
      REFERENCE_SOURCES.facilities,
    ]);
  });

  it('keeps only critical facility points', () => {
    const point = (id: string, kind: 'hospital' | 'assemblyPoint') => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [29, 41] as [number, number] },
      properties: { id, kind },
    });
    const collection = facilitiesToGeoJson({
      type: 'FeatureCollection',
      features: [point('a', 'hospital'), point('b', 'assemblyPoint')],
    });
    expect(collection.features.map((f) => String(f.properties?.id))).toEqual(['a']);
  });

  it('uses different colors per theme', () => {
    const color = (theme: 'dark' | 'light') => {
      const spec = referenceLayerSpecs(theme)[1];
      return spec?.type === 'line' ? spec.paint?.['line-color'] : undefined;
    };
    expect(color('dark')).not.toEqual(color('light'));
  });

  it('builds an upward triangle mask', () => {
    const icon = triangleIcon(16);
    const alpha = (x: number, y: number) => icon.data[(y * 16 + x) * 4 + 3];
    expect(icon.data).toHaveLength(16 * 16 * 4);
    expect(alpha(8, 3)).toBe(255); // apex
    expect(alpha(1, 3)).toBe(0); // left of the apex
    expect(alpha(1, 13)).toBe(255); // wide base
    expect(alpha(8, 15)).toBe(0); // below the base
  });
});
