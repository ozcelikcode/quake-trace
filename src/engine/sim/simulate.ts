import { EARTH_RADIUS_KM, LocalProjection, unitVector } from '@/lib/math/geo';
import type { GridSpec } from '@/types/grid';
import type { Scenario } from '@/types/scenario';
import type { DistrictImpact, SimulationResult } from '@/types/simulation';

import { asb14LnMedian } from '../gmpe/asb14';
import { combinedMmi } from '../intensity/worden2012';
import { buildRupture } from '../rupture/finite-fault';
import { IASP91_CRUST, layerIndexAt, type VelocityLayer } from '../velocity/layered-model';
import { TravelTimeCurve } from '../velocity/travel-time';
import { PolygonDistance } from './polygon-distance';

export interface SimulationInput {
  scenario: Scenario;
  grid: GridSpec;
  /** Vs30 per grid cell, m/s. */
  vs30: Float32Array;
  /** District index per grid cell (NaN outside districts), for per-district impact. */
  districtCells?: Float32Array;
  model?: readonly VelocityLayer[];
}

/** Rupture velocity as a fraction of the shear-wave velocity at the hypocentre (Heaton, 1990). */
const RUPTURE_VELOCITY_FRACTION = 0.8;
/** Longest source-to-cell distance on the regional grid, with margin. */
const MAX_DISTANCE_KM = 700;
const DURATION_PADDING_S = 5;

/**
 * Turns a scenario into arrival times, ground motion and intensity on every grid cell.
 * Arrival per cell = min over subfaults of (rupture-front time + first-arrival travel time);
 * ground motion = ASB14 median at the cell's Joyner–Boore distance and Vs30.
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

  // One travel-time curve per distinct subfault depth.
  const { subfaults } = rupture;
  const curves = new Map<number, { p: TravelTimeCurve; s: TravelTimeCurve }>();
  const pCurves: TravelTimeCurve[] = [];
  const sCurves: TravelTimeCurve[] = [];
  const subfaultVectors = new Float64Array(subfaults.count * 3);
  for (let j = 0; j < subfaults.count; j++) {
    const depth = subfaults.depthKm[j] ?? 0;
    let pair = curves.get(depth);
    if (!pair) {
      pair = {
        p: new TravelTimeCurve(model, 'P', depth, MAX_DISTANCE_KM),
        s: new TravelTimeCurve(model, 'S', depth, MAX_DISTANCE_KM),
      };
      curves.set(depth, pair);
    }
    pCurves.push(pair.p);
    sCurves.push(pair.s);
    unitVector(subfaults.lon[j] ?? 0, subfaults.lat[j] ?? 0, subfaultVectors, j * 3);
  }

  const tP = new Float32Array(cellCount);
  const tS = new Float32Array(cellCount);
  const pgaG = new Float32Array(cellCount);
  const pgvCms = new Float32Array(cellCount);
  const mmi = new Float32Array(cellCount);
  const cellVector = new Float64Array(3);
  const projection = new LocalProjection(rupture.hypocenter.lon, rupture.hypocenter.lat);
  const surface = new PolygonDistance(rupture.surfaceProjection, projection);
  const rakeDeg = spec.fault.rakeDeg;

  for (let row = 0; row < grid.ny; row++) {
    const lat = grid.north - (row + 0.5) * grid.dLat;
    for (let col = 0; col < grid.nx; col++) {
      const lon = grid.west + (col + 0.5) * grid.dLon;
      const cell = row * grid.nx + col;
      unitVector(lon, lat, cellVector, 0);
      const cx = cellVector[0] ?? 0;
      const cy = cellVector[1] ?? 0;
      const cz = cellVector[2] ?? 0;

      let bestP = Number.POSITIVE_INFINITY;
      let bestS = Number.POSITIVE_INFINITY;
      for (let j = 0; j < subfaults.count; j++) {
        const dx = cx - (subfaultVectors[j * 3] ?? 0);
        const dy = cy - (subfaultVectors[j * 3 + 1] ?? 0);
        const dz = cz - (subfaultVectors[j * 3 + 2] ?? 0);
        // Chord length; within 700 km it differs from the arc by less than 0.1 %.
        const distanceKm = EARTH_RADIUS_KM * Math.sqrt(dx * dx + dy * dy + dz * dz);
        const start = subfaults.timeS[j] ?? 0;
        const p = start + (pCurves[j]?.time(distanceKm) ?? Number.POSITIVE_INFINITY);
        const s = start + (sCurves[j]?.time(distanceKm) ?? Number.POSITIVE_INFINITY);
        if (p < bestP) bestP = p;
        if (s < bestS) bestS = s;
      }
      tP[cell] = bestP;
      tS[cell] = bestS;

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
    durationS: Math.ceil(lastArrival) + DURATION_PADDING_S,
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
