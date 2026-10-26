import { describe, expect, it } from 'vitest';

import { toScenarioEvent } from '@/features/live/lib/scenario-event';
import type { LiveEvent } from '@/types/live';

describe('live event to scenario', () => {
  it('keeps the preferred catalog values and names the source', () => {
    const report = {
      source: 'afad' as const,
      sourceId: '597383',
      timeMs: 1_000,
      lon: 28.3,
      lat: 40.1,
      depthKm: 7,
      magnitude: 4.6,
      magnitudeType: 'ML',
      place: 'Karacabey (Bursa)',
    };
    const event: LiveEvent = { ...report, id: 'afad:597383', reports: [report] };
    expect(toScenarioEvent(event)).toEqual({
      id: 'event:afad:597383',
      originMs: 1_000,
      lon: 28.3,
      lat: 40.1,
      depthKm: 7,
      magnitude: 4.6,
      place: 'Karacabey (Bursa)',
      catalog: 'AFAD 597383',
    });
  });
});
