import { describe, expect, it } from 'vitest';

import { asb14LnMedian, asb14TotalSigma, type IntensityMeasure } from '@/engine/gmpe/asb14';

import fixture from '../../../fixtures/gmpe/asb14-rjb-mean.json';

const measures: [IntensityMeasure, 'pgaG' | 'pgvCms' | 'sa03G' | 'sa06G' | 'sa10G'][] = [
  ['PGA', 'pgaG'],
  ['PGV', 'pgvCms'],
  ['SA(0.3)', 'sa03G'],
  ['SA(0.6)', 'sa06G'],
  ['SA(1.0)', 'sa10G'],
];

describe('ASB14 Rjb ground-motion model', () => {
  it(`reproduces the ${String(fixture.rows.length)}-row OpenQuake verification table`, () => {
    for (const row of fixture.rows) {
      for (const [measure, key] of measures) {
        const lnMedian = asb14LnMedian(measure, {
          mw: row.mw,
          rjbKm: row.rjbKm,
          vs30: row.vs30,
          rakeDeg: row.rakeDeg,
        });
        // The table holds 9 significant digits.
        expect(Math.abs(lnMedian - Math.log(row[key]))).toBeLessThan(1e-6);
      }
    }
  });

  it('decays with distance and grows with magnitude', () => {
    const at = (mw: number, rjbKm: number) =>
      asb14LnMedian('PGA', { mw, rjbKm, vs30: 400, rakeDeg: 180 });
    expect(at(7, 10)).toBeGreaterThan(at(7, 50));
    expect(at(7.5, 20)).toBeGreaterThan(at(6.5, 20));
  });

  it('reports the total standard deviation', () => {
    expect(asb14TotalSigma('PGA')).toBeCloseTo(Math.hypot(0.6201, 0.3501), 10);
  });
});
