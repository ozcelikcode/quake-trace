import { describe, expect, it } from 'vitest';

import { DEMAND_DECAY_S, feltShare, PEAK_DEMAND, peakDemand } from '@/engine/network/call-demand';

describe('call demand after an earthquake', () => {
  it('peaks at 55 times normal, the midpoint of 50–60 (NTT DOCOMO, 2011)', () => {
    expect(PEAK_DEMAND).toBe(55);
    expect(peakDemand(6)).toBe(55);
    expect(peakDemand(9)).toBe(55);
  });

  it('rises with the share who felt it, from intensity II to VI (USGS MMI descriptions)', () => {
    expect(feltShare(2)).toBe(0);
    expect(feltShare(1)).toBe(0);
    expect(feltShare(4)).toBeCloseTo(0.5, 12);
    expect(feltShare(6)).toBe(1);
    expect(peakDemand(2)).toBe(1);
    expect(peakDemand(4)).toBeCloseTo(28, 12);
  });

  it('decays to 5 % of the excess when the 1.42 h anomaly ends (Bagrow et al., 2011)', () => {
    expect(Math.exp(-(1.42 * 3600) / DEMAND_DECAY_S)).toBeCloseTo(Math.exp(-3), 12);
  });
});
