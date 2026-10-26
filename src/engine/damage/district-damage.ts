import type {
  DistrictDamage,
  DistrictStock,
  SpectralMeasure,
  VulnerabilityFunction,
} from '@/types/damage';

import { classShares } from './building-classes';
import { expectedRatio } from './vulnerability';

export interface DistrictDamageInput {
  stock: readonly DistrictStock[];
  functions: readonly VulnerabilityFunction[];
  /** District index per grid cell (NaN outside districts). */
  districtCells: Float32Array;
  /** Residents per grid cell, used to spread each district's buildings over its cells. */
  population: Float32Array;
  /** Median ground motion per grid cell, g. */
  measures: Record<SpectralMeasure, Float32Array>;
  /** Total log standard deviation of each measure (between- and within-event). */
  sigmaLn: Record<SpectralMeasure, number>;
}

export interface DistrictDamageResult {
  districts: DistrictDamage[];
  /** Expected structural loss ratio of the buildings in each grid cell (0 outside districts). */
  cellLossRatio: Float32Array;
}

/**
 * Expected structural loss and night-time fatalities per district: each district's buildings
 * and residents are spread over its grid cells in proportion to population (evenly when the
 * district has no populated cell); every class's vulnerability function is averaged over the
 * lognormal variability of its own intensity measure in each cell.
 */
export function districtDamage(input: DistrictDamageInput): DistrictDamageResult {
  const byTaxonomy = new Map(input.functions.map((fn) => [fn.taxonomy, fn]));
  const districts = input.stock.map((district) => {
    const classes = classShares(district.buildings.byPeriod, district.buildings.byStoreys).map(
      ({ taxonomy, share }) => {
        const fn = byTaxonomy.get(taxonomy);
        if (!fn) {
          throw new RangeError(`no usable vulnerability function for ${taxonomy}`);
        }
        return { fn, measure: input.measures[fn.imt], sigma: input.sigmaLn[fn.imt], share };
      },
    );
    return { district, classes, population: 0, cells: 0, loss: 0, fatality: 0 };
  });
  const byIndex = new Map(districts.map((entry) => [entry.district.index, entry]));

  const { districtCells, population } = input;
  const cellLossRatio = new Float32Array(districtCells.length);
  for (let cell = 0; cell < districtCells.length; cell++) {
    const entry = byIndex.get(districtCells[cell] ?? Number.NaN);
    if (!entry) continue;
    entry.population += Math.max(0, population[cell] ?? 0);
    entry.cells++;
  }

  for (let cell = 0; cell < districtCells.length; cell++) {
    const entry = byIndex.get(districtCells[cell] ?? Number.NaN);
    if (!entry) continue;
    const weight =
      entry.population > 0
        ? Math.max(0, population[cell] ?? 0) / entry.population
        : 1 / entry.cells;
    if (weight === 0) continue;
    let cellLoss = 0;
    for (const { fn, measure, sigma, share } of entry.classes) {
      const median = measure[cell] ?? 0;
      cellLoss += share * expectedRatio(fn.imls, fn.structural, median, sigma);
      entry.fatality += weight * share * expectedRatio(fn.imls, fn.fatality, median, sigma);
    }
    cellLossRatio[cell] = cellLoss;
    entry.loss += weight * cellLoss;
  }

  const results = districts.map(({ district, loss, fatality }) => ({
    index: district.index,
    buildings: district.buildings.total,
    lossRatio: loss,
    buildingsLost: district.buildings.total * loss,
    fatalities: district.population * fatality,
    estimated: district.estimated,
  }));
  return { districts: results, cellLossRatio };
}
