import { cellIndex } from '@/lib/math/grid';
import type { GridSpec } from '@/types/grid';
import type { PopulationExposure, ProvinceExposure } from '@/types/exposure';

/** Lowest intensity counted: the edge of the event grid and of the map (MMI III). */
const MIN_COUNTED_MMI = 3;
const MAX_MMI = 10;

export interface ExposureInput {
  /** Event grid and its intensity. */
  grid: GridSpec;
  mmi: Float32Array;
  /** Residents per cell and province index per cell (NaN outside), on one population grid. */
  populationGrid: GridSpec;
  population: Float32Array;
  province: Float32Array;
}

/**
 * Residents per intensity class, overall and per province, as in USGS PAGER exposure tables
 * (Wald et al., 2010): each population cell takes the median intensity at its centre, rounded to
 * the nearest class (VI = 5.5–6.5). Only classes from MMI III are counted. Returns null when the
 * shaking does not reach the population grid.
 */
export function populationExposure(input: ExposureInput): PopulationExposure | null {
  const { grid, mmi, populationGrid: pop, population, province } = input;
  const byMmi = new Array<number>(MAX_MMI + 1).fill(0);
  const provinces = new Map<number, ProvinceExposure>();
  for (let row = 0; row < pop.ny; row++) {
    const lat = pop.north - (row + 0.5) * pop.dLat;
    for (let col = 0; col < pop.nx; col++) {
      const cell = row * pop.nx + col;
      const people = population[cell] ?? 0;
      if (!(people > 0)) continue;
      const shaking = cellIndex(grid, pop.west + (col + 0.5) * pop.dLon, lat);
      if (shaking < 0) continue;
      const intensity = mmi[shaking] ?? 0;
      const level = Math.min(MAX_MMI, Math.round(intensity));
      if (level < MIN_COUNTED_MMI) continue;
      byMmi[level] = (byMmi[level] ?? 0) + people;
      const index = province[cell] ?? Number.NaN;
      if (Number.isNaN(index)) continue;
      let entry = provinces.get(index);
      if (!entry) {
        entry = { index, maxMmi: 0, populationByMmi: new Array<number>(MAX_MMI + 1).fill(0) };
        provinces.set(index, entry);
      }
      entry.maxMmi = Math.max(entry.maxMmi, intensity);
      entry.populationByMmi[level] = (entry.populationByMmi[level] ?? 0) + people;
    }
  }
  if (byMmi.every((count) => count === 0)) return null;
  return {
    populationByMmi: byMmi,
    provinces: [...provinces.values()].sort((a, b) => b.maxMmi - a.maxMmi),
  };
}
