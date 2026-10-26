import { describe, expect, it } from 'vitest';

import { classShares, residentialTaxonomy } from '@/engine/damage/building-classes';
import { districtDamage } from '@/engine/damage/district-damage';
import { facilityDamage } from '@/engine/damage/facilities';
import type { DistrictStock, VulnerabilityFunction } from '@/types/damage';

const byPeriod = { before1980: 50, from1980To2000: 50, after2000: 0 };
const byStoreys = { low: 100, mid: 0, high: 0 };

describe('building classes', () => {
  it('maps periods and storeys onto GEM taxonomies', () => {
    expect(residentialTaxonomy('before1980', 'low')).toBe('CR/LFINF/CDL+ERL/H:3/RES');
    expect(residentialTaxonomy('after2000', 'high')).toBe('CR/LFINF/CDM+ERM/H:10/RES');
  });

  it('splits the stock assuming period and storeys are independent', () => {
    const shares = classShares(
      { before1980: 1, from1980To2000: 1, after2000: 2 },
      { low: 3, mid: 1, high: 0 },
    );
    expect(shares.reduce((sum, c) => sum + c.share, 0)).toBeCloseTo(1, 12);
    const share = (period: 'after2000', storeys: 'low') =>
      shares.find((c) => c.taxonomy === residentialTaxonomy(period, storeys))?.share;
    expect(share('after2000', 'low')).toBeCloseTo(0.5 * 0.75, 12);
  });
});

describe('district damage', () => {
  const fn = (taxonomy: string, structural: number[]): VulnerabilityFunction => ({
    taxonomy,
    imt: 'PGA',
    imls: [0.1, 1],
    structural,
    fatality: structural.map((r) => r / 100),
  });
  const functions = [
    fn(residentialTaxonomy('before1980', 'low'), [0, 0.9]),
    fn(residentialTaxonomy('from1980To2000', 'low'), [0, 0.45]),
  ];
  const stock: DistrictStock[] = [
    {
      index: 0,
      population: 1000,
      estimated: false,
      buildings: { total: 100, byPeriod, byStoreys },
    },
  ];
  // Three cells: two in district 0 (all residents in the first), one outside.
  const districtCells = Float32Array.from([0, 0, Number.NaN]);
  const population = Float32Array.from([1000, 0, 500]);
  const pga = Float32Array.from([1, 0.1, 1]);
  const zero = new Float32Array(3);
  const sigma = { PGA: 0, 'SA(0.3)': 0, 'SA(0.6)': 0, 'SA(1.0)': 0 };

  it('weights cells by population and classes by their share', () => {
    const [result] = districtDamage({
      stock,
      functions,
      districtCells,
      population,
      measures: { PGA: pga, 'SA(0.3)': zero, 'SA(0.6)': zero, 'SA(1.0)': zero },
      sigmaLn: sigma,
    });
    // At 1 g: half the buildings at 0.9, half at 0.45.
    expect(result?.lossRatio).toBeCloseTo(0.675, 12);
    expect(result?.buildingsLost).toBeCloseTo(67.5, 10);
    expect(result?.fatalities).toBeCloseTo(1000 * 0.00675, 10);
  });

  it('rejects a class without a vulnerability function', () => {
    expect(() =>
      districtDamage({
        stock,
        functions: functions.slice(0, 1),
        districtCells,
        population,
        measures: { PGA: pga, 'SA(0.3)': zero, 'SA(0.6)': zero, 'SA(1.0)': zero },
        sigmaLn: sigma,
      }),
    ).toThrow(RangeError);
  });

  it('gives facilities the loss ratio of their class at the site', () => {
    const [facility, unknown] = facilityDamage(
      [
        { id: 'a', lon: 29, lat: 41, sArrivalS: 5, level: 1 },
        { id: 'b', lon: 29, lat: 41, sArrivalS: 5, level: Number.NaN },
      ],
      fn('COM', [0, 0.5]),
      0,
    );
    expect(facility?.lossRatio).toBeCloseTo(0.5, 12);
    expect(unknown?.lossRatio).toBe(0);
  });
});
