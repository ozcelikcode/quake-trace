import { haversineKm, LocalProjection } from '@/lib/math/geo';
import { cellIndex } from '@/lib/math/grid';
import type { DamageInputs, SpectralMeasure } from '@/types/damage';
import type { GridSpec } from '@/types/grid';
import type { NetworkResult } from '@/types/network';
import type { RoadGraph } from '@/types/roads';
import type { RoutingResult } from '@/types/routing';
import type { Scenario } from '@/types/scenario';
import type { DistrictImpact, SimulationResult, StationSite } from '@/types/simulation';

import { aftershockCatalog } from '../aftershocks/catalog';
import { populationExposure } from '../exposure/population-exposure';
import { FACILITY_TAXONOMY } from '../damage/building-classes';
import { districtDamage } from '../damage/district-damage';
import { facilityDamage } from '../damage/facilities';
import { earlyWarning } from '../eew/early-warning';
import { asb14LnMedian, asb14TotalSigma } from '../gmpe/asb14';
import { eventGrid, shakingRadiusKm } from '../grid/event-grid';
import { settlementClasses } from '../grid/settlement';
import { combinedMmi } from '../intensity/worden2012';
import { cellNetwork } from '../network/network';
import { emergencyResponse } from '../routing/response';
import { createRandom, deriveSeed } from '../random/random';
import { buildRupture } from '../rupture/finite-fault';
import { IASP91_CRUST, layerIndexAt, type VelocityLayer } from '../velocity/layered-model';
import { RuptureArrivals } from './arrivals';
import { districtCentres } from './district-centres';
import { PolygonDistance } from './polygon-distance';
import { planStations, synthesizeRecords } from './stations';

export interface SimulationInput {
  scenario: Scenario;
  /**
   * The regional grid: where site data exist and where the impact modules (districts, damage,
   * network, routing) run. Shaking is computed on an event-centred grid sized by magnitude;
   * Vs30 comes from this grid inside it and `DEFAULT_VS30` outside.
   */
  grid: GridSpec;
  /** Vs30 per regional grid cell, m/s. */
  vs30: Float32Array;
  /** Further Vs30 grids (worldwide tiles), used where the regional grid has no value. */
  siteGrids?: readonly { spec: GridSpec; values: Float32Array }[];
  /** Population and provinces of a wider area (Türkiye) for exposure counts. */
  exposure?: { grid: GridSpec; population: Float32Array; province: Float32Array };
  /** The event-centred grid, when the caller already planned it (`planEventGrid`). */
  eventGrid?: GridSpec;
  /** Most cells of the event-centred grid (fewer on phones); default `MAX_EVENT_CELLS`. */
  maxEventCells?: number;
  /** District index per regional grid cell (NaN outside districts), for per-district impact. */
  districtCells?: Float32Array;
  /** Stations that receive synthetic records. */
  stations?: readonly StationSite[];
  /** Building stock, vulnerability and facilities for damage estimates (needs `districtCells`). */
  damage?: DamageInputs;
  /**
   * Cell sites for the network load (needs `damage`); `siteLonLat` null generates synthetic
   * sites from the population.
   */
  network?: { siteLonLat: Float32Array | null };
  /** Major road network for emergency routing (needs `damage`). */
  roads?: RoadGraph;
  model?: readonly VelocityLayer[];
}

const SPECTRAL_MEASURES: readonly Exclude<SpectralMeasure, 'PGA'>[] = [
  'SA(0.3)',
  'SA(0.6)',
  'SA(1.0)',
];

/** Rupture velocity as a fraction of the shear-wave velocity at the hypocentre (Heaton, 1990). */
const RUPTURE_VELOCITY_FRACTION = 0.8;
const DURATION_PADDING_S = 5;
/** Cells of the event grid on desktops: Mw 7.4 near İstanbul gets cells of about 1.7 km. */
export const MAX_EVENT_CELLS = 250_000;
/**
 * Vs30 where neither the regional grid nor the worldwide tiles have a value (polar regions):
 * the NEHRP B/C boundary, the usual reference rock (BSSC, 2020).
 */
export const DEFAULT_VS30 = 760;
/** Travel-time tables reach this far beyond the farthest grid corner. */
const DISTANCE_MARGIN_KM = 50;

/**
 * Turns a scenario into arrival times, ground motion and intensity on an event-centred grid
 * (wide enough that its edges fall below the drawn intensity), synthetic records at the
 * stations, and, where the shaking reaches the regional grid, the impact estimates there.
 */
function scenarioRupture(scenario: Scenario, model: readonly VelocityLayer[]) {
  const hypocentreLayer = model[layerIndexAt(model, scenario.rupture.hypocenterDepthKm)];
  if (!hypocentreLayer) throw new RangeError('the velocity model has no layers');
  return buildRupture(scenario.rupture, {
    ruptureVelocityKmS: RUPTURE_VELOCITY_FRACTION * hypocentreLayer.vsKmS,
  });
}

/**
 * The event-centred grid of a scenario, so a caller can fetch the site data it covers before
 * simulating.
 */
export function planEventGrid(
  scenario: Scenario,
  maxCells = MAX_EVENT_CELLS,
  model: readonly VelocityLayer[] = IASP91_CRUST,
): GridSpec {
  const rupture = scenarioRupture(scenario, model);
  return eventGrid(
    rupture.surfaceProjection,
    shakingRadiusKm(rupture.mw, scenario.rupture.fault.rakeDeg),
    maxCells,
  );
}

export function simulate(input: SimulationInput): SimulationResult {
  const started = performance.now();
  const { scenario, vs30 } = input;
  const region = input.grid;
  const model = input.model ?? IASP91_CRUST;
  if (vs30.length !== region.nx * region.ny) throw new RangeError('vs30 does not match the grid');

  const spec = scenario.rupture;
  const rupture = scenarioRupture(scenario, model);
  const rakeDeg = spec.fault.rakeDeg;
  const grid = input.eventGrid ?? planEventGrid(scenario, input.maxEventCells, model);
  const { lon: hypoLon, lat: hypoLat } = rupture.hypocenter;
  const reachKm =
    Math.max(farthestCornerKm(grid, hypoLon, hypoLat), farthestCornerKm(region, hypoLon, hypoLat)) +
    rupture.lengthKm +
    DISTANCE_MARGIN_KM;
  const arrivals = new RuptureArrivals(rupture, model, reachKm);
  const projection = new LocalProjection(hypoLon, hypoLat);
  const surface = new PolygonDistance(rupture.surfaceProjection, projection);

  const siteGrids = [{ spec: region, values: vs30 }, ...(input.siteGrids ?? [])];
  // Regional data first, then the worldwide tiles (longitudes wrapped), then the default.
  const vs30At = (lon: number, lat: number) => {
    const wrapped = ((((lon + 180) % 360) + 360) % 360) - 180;
    for (const site of siteGrids) {
      const cell = cellIndex(site.spec, wrapped, lat);
      const value = cell < 0 ? Number.NaN : (site.values[cell] ?? Number.NaN);
      if (Number.isFinite(value)) return value;
    }
    return DEFAULT_VS30;
  };
  const eventVs30 = sampleOnGrid(grid, vs30At);
  const shaking = shakingField(grid, eventVs30, { arrivals, surface, mw: rupture.mw, rakeDeg });
  const { tP, tS, pgaG, pgvCms, mmi } = shaking;

  let lastArrival = 0;
  for (const value of tS) if (Number.isFinite(value) && value > lastArrival) lastArrival = value;
  const stations = planStations(input.stations ?? [], {
    rupture,
    arrivals,
    surface,
    vs30At,
    rakeDeg,
  });
  for (const station of stations) lastArrival = Math.max(lastArrival, station.endS);
  const durationS = Math.ceil(lastArrival) + DURATION_PADDING_S;
  const records = synthesizeRecords(stations, scenario.seed, durationS);

  // The impact modules run on the regional grid, and only when the shaking reaches it.
  const regional =
    input.districtCells && overlaps(grid, region)
      ? shakingField(region, vs30, { arrivals, surface, mw: rupture.mw, rakeDeg })
      : null;
  const districts =
    input.districtCells && regional
      ? districtImpacts(input.districtCells, regional.tP, regional.tS, regional.mmi)
      : [];

  return {
    scenarioId: scenario.id,
    grid,
    regionGrid: region,
    inRegion: regional !== null,
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
    districts,
    records,
    ...(regional
      ? impactEstimates(input, districts, {
          grid: region,
          vs30,
          ...regional,
          mw: rupture.mw,
          rakeDeg,
          surface,
        })
      : { damage: null, network: null, routing: null }),
    earlyWarning: earlyWarning({
      stations: records.stations,
      rupture,
      rakeDeg,
      model,
      seed: scenario.seed,
    }),
    aftershocks: aftershockCatalog(
      {
        mw: rupture.mw,
        trace: rupture.trace,
        dipDeg: spec.fault.dipDeg,
        upperDepthKm: spec.fault.upperDepthKm,
        lowerDepthKm: spec.fault.lowerDepthKm,
      },
      createRandom(deriveSeed(scenario.seed, 'aftershocks')),
    ),
    exposure: input.exposure
      ? populationExposure({
          grid,
          mmi,
          populationGrid: input.exposure.grid,
          population: input.exposure.population,
          province: input.exposure.province,
        })
      : null,
    durationS,
    computeMs: performance.now() - started,
  };
}

interface ShakingField {
  tP: Float32Array<ArrayBuffer>;
  tS: Float32Array<ArrayBuffer>;
  pgaG: Float32Array<ArrayBuffer>;
  pgvCms: Float32Array<ArrayBuffer>;
  mmi: Float32Array<ArrayBuffer>;
  rjbKm: Float32Array<ArrayBuffer>;
}

/**
 * Arrival per cell = min over subfaults of (rupture-front time + first-arrival travel time);
 * ground motion = ASB14 median at the cell's Joyner–Boore distance and Vs30.
 */
function shakingField(
  grid: GridSpec,
  vs30: Float32Array,
  source: { arrivals: RuptureArrivals; surface: PolygonDistance; mw: number; rakeDeg: number },
): ShakingField {
  const cellCount = grid.nx * grid.ny;
  const field: ShakingField = {
    tP: new Float32Array(cellCount),
    tS: new Float32Array(cellCount),
    pgaG: new Float32Array(cellCount),
    pgvCms: new Float32Array(cellCount),
    mmi: new Float32Array(cellCount),
    rjbKm: new Float32Array(cellCount),
  };
  const { arrivals, surface, mw, rakeDeg } = source;
  for (let row = 0; row < grid.ny; row++) {
    const lat = grid.north - (row + 0.5) * grid.dLat;
    for (let col = 0; col < grid.nx; col++) {
      const lon = grid.west + (col + 0.5) * grid.dLon;
      const cell = row * grid.nx + col;
      arrivals.locate(lon, lat);
      field.tP[cell] = arrivals.pArrivalS;
      field.tS[cell] = arrivals.sArrivalS;
      const rjbKm = surface.distanceKm(lon, lat);
      field.rjbKm[cell] = rjbKm;
      const motion = { mw, rjbKm, vs30: vs30[cell] ?? Number.NaN, rakeDeg };
      const pga = Math.exp(asb14LnMedian('PGA', motion));
      const pgv = Math.exp(asb14LnMedian('PGV', motion));
      field.pgaG[cell] = pga;
      field.pgvCms[cell] = pgv;
      field.mmi[cell] = combinedMmi(pga, pgv);
    }
  }
  return field;
}

/** A point function sampled at every cell centre of a grid. */
function sampleOnGrid(grid: GridSpec, at: (lon: number, lat: number) => number): Float32Array {
  const values = new Float32Array(grid.nx * grid.ny);
  for (let row = 0; row < grid.ny; row++) {
    const lat = grid.north - (row + 0.5) * grid.dLat;
    for (let col = 0; col < grid.nx; col++) {
      values[row * grid.nx + col] = at(grid.west + (col + 0.5) * grid.dLon, lat);
    }
  }
  return values;
}

function overlaps(a: GridSpec, b: GridSpec): boolean {
  return (
    a.west < b.west + b.nx * b.dLon &&
    b.west < a.west + a.nx * a.dLon &&
    a.north - a.ny * a.dLat < b.north &&
    b.north - b.ny * b.dLat < a.north
  );
}

/** Great-circle distance from a point to the farthest corner of a grid, km. */
function farthestCornerKm(grid: GridSpec, lon: number, lat: number): number {
  const east = grid.west + grid.nx * grid.dLon;
  const south = grid.north - grid.ny * grid.dLat;
  return Math.max(
    haversineKm(lon, lat, grid.west, grid.north),
    haversineKm(lon, lat, east, grid.north),
    haversineKm(lon, lat, grid.west, south),
    haversineKm(lon, lat, east, south),
  );
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
  mmi: Float32Array;
  mw: number;
  rakeDeg: number;
  surface: PolygonDistance;
}

type ImpactEstimates = Pick<SimulationResult, 'damage' | 'network' | 'routing'>;

/** Damage, then the cell network and road response that depend on it. */
function impactEstimates(
  input: SimulationInput,
  impacts: readonly DistrictImpact[],
  context: GroundMotionContext,
): ImpactEstimates {
  const { damage: inputs, districtCells } = input;
  if (!inputs || !districtCells) return { damage: null, network: null, routing: null };
  const { grid, vs30, mw, rakeDeg } = context;
  const motionAt = (lon: number, lat: number) => {
    const cell = cellIndex(grid, lon, lat);
    return {
      cell,
      motion: {
        mw,
        rjbKm: context.surface.distanceKm(lon, lat),
        vs30: cell < 0 ? Number.NaN : (vs30[cell] ?? Number.NaN),
        rakeDeg,
      },
    };
  };
  const arrivalAt = (cell: number) =>
    cell < 0 ? Number.POSITIVE_INFINITY : (context.tS[cell] ?? Number.POSITIVE_INFINITY);

  const facilityFunction = inputs.functions.find((fn) => fn.taxonomy === FACILITY_TAXONOMY);
  if (!facilityFunction) throw new RangeError(`no vulnerability function for ${FACILITY_TAXONOMY}`);
  const facilitySigma = asb14TotalSigma(facilityFunction.imt);
  const facilities = facilityDamage(
    inputs.facilities.map((facility) => {
      const { cell, motion } = motionAt(facility.lon, facility.lat);
      return {
        ...facility,
        sArrivalS: arrivalAt(cell),
        level: Math.exp(asb14LnMedian(facilityFunction.imt, motion)),
      };
    }),
    facilityFunction,
    facilitySigma,
  );

  const spectral = spectralOnCells(districtCells, context);
  const { districts, cellLossRatio } = districtDamage({
    stock: inputs.stock,
    functions: inputs.functions,
    districtCells,
    population: inputs.population,
    measures: spectral,
    sigmaLn: {
      PGA: asb14TotalSigma('PGA'),
      'SA(0.3)': asb14TotalSigma('SA(0.3)'),
      'SA(0.6)': asb14TotalSigma('SA(0.6)'),
      'SA(1.0)': asb14TotalSigma('SA(1.0)'),
    },
  });

  const settlement = settlementClasses(grid, inputs.population);
  const network: NetworkResult | null = input.network
    ? cellNetwork({
        grid,
        land: districtCells,
        population: inputs.population,
        settlement,
        siteLonLat: input.network.siteLonLat ?? undefined,
        tS: context.tS,
        mmi: context.mmi,
        hostFunction: facilityFunction,
        hostLevel: spectral[facilityFunction.imt],
        hostSigmaLn: facilitySigma,
      })
    : null;

  let routing: RoutingResult | null = null;
  if (input.roads) {
    const centres = districtCentres(grid, districtCells, inputs.population);
    const arrivals = new Map(impacts.map((impact) => [impact.index, impact.sArrivalS]));
    routing = emergencyResponse({
      graph: input.roads,
      grid,
      settlement,
      cellLossRatio,
      sa1G: (lon, lat) => Math.exp(asb14LnMedian('SA(1.0)', motionAt(lon, lat).motion)),
      tS: context.tS,
      facilities,
      districts: districts.flatMap((district) => {
        const centre = centres.get(district.index);
        if (!centre) return [];
        return [
          {
            index: district.index,
            ...centre,
            sArrivalS: arrivals.get(district.index) ?? Number.POSITIVE_INFINITY,
            buildingsLost: district.buildingsLost,
          },
        ];
      }),
    });
  }

  return { damage: { districts, facilities }, network, routing };
}

/** Every vulnerability measure on the district cells: PGA from the grid, SA from ASB14. */
function spectralOnCells(
  districtCells: Float32Array,
  context: GroundMotionContext,
): Record<SpectralMeasure, Float32Array> {
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
  return { PGA: context.pgaG, ...spectral };
}
