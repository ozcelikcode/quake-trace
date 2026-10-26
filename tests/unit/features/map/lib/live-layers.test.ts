import { describe, expect, it } from 'vitest';

import { liveLayerSpec, liveToGeoJson } from '@/features/map/lib/live-layers';
import type { LiveEvent } from '@/types/live';

describe('live map layer', () => {
  it('carries id, magnitude and age in hours', () => {
    const report = {
      source: 'emsc' as const,
      sourceId: 'x',
      timeMs: 0,
      lon: 29,
      lat: 40.9,
      depthKm: 5,
      magnitude: 3.2,
      magnitudeType: 'ML',
      place: '',
    };
    const event: LiveEvent = { ...report, id: 'emsc:x', reports: [report] };
    const [feature] = liveToGeoJson([event], 2 * 3_600_000).features;
    expect(feature?.geometry.coordinates).toEqual([29, 40.9]);
    expect(feature?.properties).toEqual({ id: 'emsc:x', magnitude: 3.2, ageH: 2 });
  });

  it('draws circles in both themes', () => {
    expect(liveLayerSpec('dark').type).toBe('circle');
    expect(liveLayerSpec('light').id).toBe(liveLayerSpec('dark').id);
  });
});
