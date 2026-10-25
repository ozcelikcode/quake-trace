import { describe, expect, it } from 'vitest';

import {
  basemapStyleUrl,
  demSource,
  HILLSHADE_SOURCE_ID,
  hillshadeLayer,
  INITIAL_VIEW_CENTER,
} from '@/features/map/lib/map-config';

describe('map configuration', () => {
  it('uses keyless OpenFreeMap styles per theme', () => {
    expect(basemapStyleUrl('dark')).toBe('https://tiles.openfreemap.org/styles/dark');
    expect(basemapStyleUrl('light')).toBe('https://tiles.openfreemap.org/styles/positron');
  });

  it('reads AWS Terrain Tiles with Terrarium encoding and attribution', () => {
    const source = demSource();
    expect(source.encoding).toBe('terrarium');
    expect(source.tiles?.[0]).toMatch(
      /^https:\/\/s3\.amazonaws\.com\/elevation-tiles-prod\/terrarium\//,
    );
    expect(source.attribution).toContain('Mapzen');
  });

  it('centers the opening view on the Sea of Marmara', () => {
    const [lon, lat] = INITIAL_VIEW_CENTER;
    expect(lon).toBeCloseTo(28.6, 5);
    expect(lat).toBeCloseTo(40.75, 5);
  });

  it('builds a hillshade layer per theme on its own source', () => {
    const dark = hillshadeLayer('dark');
    const light = hillshadeLayer('light');
    expect(dark.source).toBe(HILLSHADE_SOURCE_ID);
    expect(dark.paint).not.toEqual(light.paint);
  });
});
