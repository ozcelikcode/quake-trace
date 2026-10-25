import { describe, expect, it } from 'vitest';

import { firstTriggerIndex, staLtaRatio } from '@/engine/eew/sta-lta';

describe('classic STA/LTA (Trnkoczy, 2012; ObsPy classic_sta_lta windows)', () => {
  it('is 0 until the LTA window is full and 1 on a stationary signal', () => {
    const signal = Array.from({ length: 300 }, (_, i) => (i % 2 ? 2 : -2));
    const ratio = staLtaRatio(signal, 10, 100);
    expect(ratio[98]).toBe(0);
    expect(ratio[99]).toBeCloseTo(1, 12);
    expect(ratio[299]).toBeCloseTo(1, 12);
  });

  it('follows the analytic ratio across an amplitude step', () => {
    // Amplitude 1 then 5 from sample 1000; STA 10, LTA 100 samples. With j + 1 samples past the
    // step: STA = (10 + 4(j + 1)) / 10 and LTA = (100 + 4(j + 1)) / 100.
    const signal = Array.from({ length: 1200 }, (_, i) => (i < 1000 ? 1 : 5));
    const ratio = staLtaRatio(signal, 10, 100);
    const analytic = (j: number) => (10 * (10 + 4 * (j + 1))) / (100 + 4 * (j + 1));
    for (let j = 0; j < 10; j++) expect(ratio[1000 + j]).toBeCloseTo(analytic(j), 12);
    // analytic(6) = 2.97 and analytic(7) = 3.18: a threshold of 3 trips on the eighth sample.
    expect(firstTriggerIndex(ratio, 3)).toBe(1007);
  });

  it('reports no trigger below the threshold and rejects inconsistent windows', () => {
    expect(firstTriggerIndex(new Float64Array(50).fill(1.5), 4)).toBe(-1);
    expect(() => staLtaRatio([1, 2, 3], 0, 10)).toThrow(RangeError);
    expect(() => staLtaRatio([1, 2, 3], 20, 10)).toThrow(RangeError);
  });
});
