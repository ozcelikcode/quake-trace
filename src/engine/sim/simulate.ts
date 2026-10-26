import { LocalProjection } from '@/lib/math/geo';
import type { GridSpec } from '@/types/grid';
import type { Scenario } from '@/types/scenario';
import type { DistrictImpact, SimulationResult, StationSite } from '@/types/simulation';

import { earlyWarning } from '../eew/early-warning';
import { asb14LnMedian } from '../gmpe/asb14';
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
  model?: readonly VelocityLayer[];
}

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

      const motion = {
        mw: rupture.mw,
        rjbKm: surface.distanceKm(lon, lat),
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
