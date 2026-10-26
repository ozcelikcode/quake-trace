import { describe, expect, it } from 'vitest';

import { timeTicks } from '@/features/telemetry/lib/time-ticks';

describe('time axis ticks', () => {
  it('uses the smallest step that keeps labels apart', () => {
    // 300 px over 100 s: 10 s steps are 30 px apart, 15 s steps 45 px.
    expect(timeTicks(100, 300, 36)).toEqual([0, 15, 30, 45, 60, 75, 90]);
    expect(timeTicks(100, 600, 36)).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
  });

  it('is empty for an empty axis', () => {
    expect(timeTicks(0, 300, 36)).toEqual([]);
  });
});
