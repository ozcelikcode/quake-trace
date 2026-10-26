import { LocalProjection } from '@/lib/math/geo';
import { cellIndex } from '@/lib/math/grid';
import type { DamageInputs, SpectralMeasure } from '@/types/damage';
import type { GridSpec } from '@/types/grid';
import type { Scenario } from '@/types/scenario';
import type { DistrictImpact, SimulationResult, StationSite } from '@/types/simulation';

import { FACILITY_TAXONOMY } from '../damage/building-classes';
import { districtDamage } from '../damage/district-damage';
import { facilityDamage } from '../damage/facilities';
import { earlyWarning } from '../eew/early-warning';
import { asb14LnMedian, asb14TotalSigma } from '../gmpe/asb14';
import { combinedMmi } from '../intensity/worden2012';
import { buildRupture } from '../rupture/finite-fault';
import { IASP91_CRUST, layerIndexAt, type VelocityLayer } from '../velocity/layered-model';
import { RuptureArrivals } from './arrivals';
import { PolygonDistance } from './polygon-distance';
import { planStations, synthesizeRecords } from './stations';

export interface SimulationInput {
  scenario: Scenario;
  grid: GridSpec;
  /** Vs30 per grid cell, m/s. */
  vs30: Float32Array;
  /** District index per grid cell (NaN outside districts), for per-district impact. */
  districtCells?: Float32Array;
  /** Stations that receive synthetic records. */
  stations?: readonly StationSite[];
  /** Building stock, vulnerability and facilities for damage estimates (needs `districtCells`). */
  damage?: DamageInputs;
  model?: readonly VelocityLayer[];
}

const SPECTRAL_MEASURES: readonly Exclude<SpectralMeasure, 'PGA'>[] = [
  'SA(0.3)',
  'SA(0.6)',
  'SA(1.0)',
];

/** Rupture velocity as a fraction of the shear-wave velocity at the hypocentre (Heaton, 1990). */
const RUPTURE_VELOCITY_FRACTION = 0.8;
/** Longest source-to-cell distance on the regional grid, with margin. */
const MAX_DISTANCE_KM = 700;
const DURATION_PADDING_S = 5;

/**
 * Turns a scenario into arrival times, ground motion and intensity on every grid cell, and
 * synthetic records at the stations. Arrival per cell = min over subfaults of (rupture-front
 * time + first-arrival travel time); ground motion = ASB14 median at the cell's Joyner–Boore
 * distance and Vs30.
 */
export function simulate(input: SimulationInput): SimulationResult {
  const started = performance.now();
  const { grid, scenario, vs30 } = input;
  const model = input.model ?? IASP91_CRUST;
  const cellCount = grid.nx * grid.ny;
  if (vs30.length !== cellCount) throw new RangeError('vs30 does not match the grid');

  const spec = scenario.rupture;
  const hypocentreLayer = model[layerIndexAt(model, spec.hypocenterDepthKm)];
  if (!hypocentreLayer) throw new RangeError('the velocity model has no layers');
  const rupture = buildRupture(spec, {
    ruptureVelocityKmS: RUPTURE_VELOCITY_FRACTION * hypocentreLayer.vsKmS,
  });
  const arrivals = new RuptureArrivals(rupture, model, MAX_DISTANCE_KM);

  const tP = new Float32Array(cellCount);
  const tS = new Float32Array(cellCount);
  const pgaG = new Float32Array(cellCount);
  const pgvCms = new Float32Array(cellCount);
  const mmi = new Float32Array(cellCount);
  const rjbKm = new Float32Array(cellCount);
  const projection = new LocalProjection(rupture.hypocenter.lon, rupture.hypocenter.lat);
  const surface = new PolygonDistance(rupture.surfaceProjection, projection);
  const rakeDeg = spec.fault.rakeDeg;

  for (let row = 0; row < grid.ny; row++) {
    const lat = grid.north - (row + 0.5) * grid.dLat;
    for (let col = 0; col < grid.nx; col++) {
      const lon = grid.west + (col + 0.5) * grid.dLon;
      const cell = row * grid.nx + col;
      arrivals.locate(lon, lat);
      tP[cell] = arrivals.pArrivalS;
      tS[cell] = arrivals.sArrivalS;

      rjbKm[cell] = surface.distanceKm(lon, lat);
      const motion = {
        mw: rupture.mw,
        rjbKm: rjbKm[cell] ?? 0,
        vs30: vs30[cell] ?? Number.NaN,
        rakeDeg,
      };
      const pga = Math.exp(asb14LnMedian('PGA', motion));
      const pgv = Math.exp(asb14LnMedian('PGV', motion));
      pgaG[cell] = pga;
      pgvCms[cell] = pgv;
      mmi[cell] = combinedMmi(pga, pgv);
    }
  }

  let lastArrival = 0;
  for (const value of tS) if (Number.isFinite(value) && value > lastArrival) lastArrival = value;
  const stations = planStations(input.stations ?? [], {
    rupture,
    arrivals,
    surface,
    grid,
    vs30,
    rakeDeg,
  });
  for (const station of stations) lastArrival = Math.max(lastArrival, station.endS);
  const durationS = Math.ceil(lastArrival) + DURATION_PADDING_S;
  const records = synthesizeRecords(stations, scenario.seed, durationS);

  return {
    scenarioId: scenario.id,
    grid,
    tP,
    tS,
    pgaG,
    pgvCms,
    mmi,
    rupture: {
      mw: rupture.mw,
      lengthKm: rupture.lengthKm,
      widthKm: rupture.widthKm,
      areaKm2: rupture.areaKm2,
      hypocenter: rupture.hypocenter,
      trace: rupture.trace,
      traceTimesS: rupture.traceTimesS,
      ruptureDurationS: rupture.durationS,
    },
    districts: input.districtCells ? districtImpacts(input.districtCells, tP, tS, mmi) : [],
    records,
    damage:
      input.damage && input.districtCells
        ? estimateDamage(input.damage, input.districtCells, {
            grid,
            vs30,
            rjbKm,
            pgaG,
            tS,
            mw: rupture.mw,
            rakeDeg,
            surface,
          })
        : null,
    earlyWarning: earlyWarning({
      stations: records.stations,
      rupture,
      rakeDeg,
      model,
      seed: scenario.seed,
    }),
    durationS,
    computeMs: performance.now() - started,
  };
}

/** Earliest arrivals and the strongest intensity over each district's cells. */
export function districtImpacts(
  districtCells: Float32Array,
  tP: Float32Array,
  tS: Float32Array,
  mmi: Float32Array,
): DistrictImpact[] {
  const byIndex = new Map<number, DistrictImpact>();
  for (let cell = 0; cell < districtCells.length; cell++) {
    const index = districtCells[cell] ?? Number.NaN;
    if (Number.isNaN(index)) continue;
    const p = tP[cell] ?? Number.POSITIVE_INFINITY;
    const s = tS[cell] ?? Number.POSITIVE_INFINITY;
    const intensity = mmi[cell] ?? 0;
    const current = byIndex.get(index);
    if (current) {
      current.pArrivalS = Math.min(current.pArrivalS, p);
      current.sArrivalS = Math.min(current.sArrivalS, s);
      current.maxMmi = Math.max(current.maxMmi, intensity);
    } else {
      byIndex.set(index, { index, pArrivalS: p, sArrivalS: s, maxMmi: intensity });
    }
  }
  return [...byIndex.values()].sort((a, b) => a.sArrivalS - b.sArrivalS);
}

interface GroundMotionContext {
  grid: GridSpec;
  vs30: Float32Array;
  rjbKm: Float32Array;
  pgaG: Float32Array;
  tS: Float32Array;
  mw: number;
  rakeDeg: number;
  surface: PolygonDistance;
}

/** Spectral accelerations on the district cells, then district and facility damage. */
function estimateDamage(
  inputs: DamageInputs,
  districtCells: Float32Array,
  context: GroundMotionContext,
): NonNullable<SimulationResult['damage']> {
  const { vs30, rjbKm, mw, rakeDeg } = context;
  const cellCount = districtCells.length;
  const spectral = {
    'SA(0.3)': new Float32Array(cellCount),
    'SA(0.6)': new Float32Array(cellCount),
    'SA(1.0)': new Float32Array(cellCount),
  };
  for (let cell = 0; cell < cellCount; cell++) {
    if (Number.isNaN(districtCells[cell] ?? Number.NaN)) continue;
    const motion = { mw, rjbKm: rjbKm[cell] ?? 0, vs30: vs30[cell] ?? Number.NaN, rakeDeg };
    for (const measure of SPECTRAL_MEASURES) {
      spectral[measure][cell] = Math.exp(asb14LnMedian(measure, motion));
    }
  }

  const facilityFunction = inputs.functions.find((fn) => fn.taxonomy === FACILITY_TAXONOMY);
  if (!facilityFunction) throw new RangeError(`no vulnerability function for ${FACILITY_TAXONOMY}`);
  const sites = inputs.facilities.map((facility) => {
    const cell = cellIndex(context.grid, facility.lon, facility.lat);
    const siteVs30 = cell < 0 ? Number.NaN : (vs30[cell] ?? Number.NaN);
    const motion = {
      mw,
      rjbKm: context.surface.distanceKm(facility.lon, facility.lat),
      vs30: siteVs30,
      rakeDeg,
    };
    return {
      id: facility.id,
      lon: facility.lon,
      lat: facility.lat,
      sArrivalS:
        cell < 0 ? Number.POSITIVE_INFINITY : (context.tS[cell] ?? Number.POSITIVE_INFINITY),
      level: Math.exp(asb14LnMedian(facilityFunction.imt, motion)),
    };
  });

  return {
    districts: districtDamage({
      stock: inputs.stock,
      functions: inputs.functions,
      districtCells,
      population: inputs.population,
      measures: { PGA: context.pgaG, ...spectral },
      sigmaLn: {
        PGA: asb14TotalSigma('PGA'),
        'SA(0.3)': asb14TotalSigma('SA(0.3)'),
        'SA(0.6)': asb14TotalSigma('SA(0.6)'),
        'SA(1.0)': asb14TotalSigma('SA(1.0)'),
      },
    }),
    facilities: facilityDamage(sites, facilityFunction, asb14TotalSigma(facilityFunction.imt)),
  };
}
