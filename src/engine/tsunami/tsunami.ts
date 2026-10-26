import { cellIndex } from '@/lib/math/grid';
import type { GridSpec } from '@/types/grid';
import type { Scenario } from '@/types/scenario';
import type { CoastalTsunami, TsunamiResult } from '@/types/tsunami';

import { buildRupture } from '../rupture/finite-fault';
import { LinearShallowWater } from './shallow-water';
import { averageSlipM, faultRectangles, seafloorUplift } from './source';

export interface TsunamiInput {
  scenario: Scenario;
  /** Elevation on the sea grid, m (negative under water, NaN on land). */
  bathymetry: { spec: GridSpec; values: Float32Array };
  /** District index on the display grid (NaN outside districts). */
  districtCells: { spec: GridSpec; values: Float32Array };
  durationS?: number;
  frameIntervalS?: number;
}

/** One hour covers the Marmara Sea crossings (about 30 min end to end at 100 m/s). */
const DEFAULT_DURATION_S = 3600;
const DEFAULT_FRAME_S = 15;
/**
 * Change of the sea surface from its initial (coseismic) shape taken as the wave's arrival, m (a
 * display assumption). Measured from the initial surface because the Okada uplift itself reaches
 * coasts tens of kilometres away.
 */
const ARRIVAL_THRESHOLD_M = 0.01;
const MM = 1000;
const INT16_MAX = 32_767;

/**
 * Tsunami of a scenario: Okada seafloor uplift of the rupture (`source.ts`) propagated with
 * the linear shallow-water solver (`shallow-water.ts`) on the 500 m bathymetry for an hour.
 * Frames are averaged onto the 1 km display grid; coastal cells (sea cells next to land) give
 * each district its first arrival and highest sea surface. Educational and simplified: no
 * run-up, no dispersion, no landslide sources.
 */
export function simulateTsunami(input: TsunamiInput): TsunamiResult {
  const started = performance.now();
  const { scenario, bathymetry } = input;
  const sea = bathymetry.spec;
  const display = input.districtCells.spec;
  const durationS = input.durationS ?? DEFAULT_DURATION_S;
  const frameIntervalS = input.frameIntervalS ?? DEFAULT_FRAME_S;
  const factor = Math.round(display.dLon / sea.dLon);
  if (
    factor < 1 ||
    Math.abs(display.dLat / sea.dLat - factor) > 1e-6 ||
    sea.west !== display.west ||
    sea.north !== display.north
  ) {
    throw new RangeError('the display grid must be a whole-cell coarsening of the sea grid');
  }

  // The rupture's geometry only; front timing does not enter the static source.
  const rupture = buildRupture(scenario.rupture, { ruptureVelocityKmS: 1 });
  const { fault } = scenario.rupture;
  const rupturedGeometry = {
    mw: rupture.mw,
    areaKm2: rupture.areaKm2,
    trace: rupture.trace,
    dipDeg: fault.dipDeg,
    rakeDeg: fault.rakeDeg,
    topDepthKm: fault.upperDepthKm,
    bottomDepthKm: fault.lowerDepthKm,
  };

  const seaCells = sea.nx * sea.ny;
  const depth = new Float32Array(seaCells);
  const wet = new Uint8Array(seaCells);
  for (let cell = 0; cell < seaCells; cell++) {
    const elevation = bathymetry.values[cell] ?? Number.NaN;
    if (elevation < 0) {
      depth[cell] = -elevation;
      wet[cell] = 1;
    }
  }
  const uplift = seafloorUplift(faultRectangles(rupturedGeometry), sea, wet);
  let maxUpliftM = 0;
  let minUpliftM = 0;
  for (const value of uplift) {
    maxUpliftM = Math.max(maxUpliftM, value);
    minUpliftM = Math.min(minUpliftM, value);
  }

  const model = new LinearShallowWater(sea, depth);
  model.setInitialSurface(uplift);

  // Display cells and the sea cells averaged into each.
  const displayCells: number[] = [];
  const members: number[][] = [];
  for (let row = 0; row < display.ny; row++) {
    for (let col = 0; col < display.nx; col++) {
      const inside: number[] = [];
      for (let r = row * factor; r < (row + 1) * factor && r < sea.ny; r++) {
        for (let c = col * factor; c < (col + 1) * factor && c < sea.nx; c++) {
          if (wet[r * sea.nx + c]) inside.push(r * sea.nx + c);
        }
      }
      if (inside.length === 0) continue;
      displayCells.push(row * display.nx + col);
      members.push(inside);
    }
  }
  const frameCount = Math.floor(durationS / frameIntervalS) + 1;
  const framesMm = new Int16Array(frameCount * displayCells.length);
  const writeFrame = (frame: number) => {
    const offset = frame * displayCells.length;
    members.forEach((cells, k) => {
      let sum = 0;
      for (const cell of cells) sum += model.eta[cell] ?? 0;
      const mm = Math.round((sum / cells.length) * MM);
      framesMm[offset + k] = Math.max(-INT16_MAX, Math.min(INT16_MAX, mm));
    });
  };

  const seaMax = new Float32Array(seaCells);
  const seaArrival = new Float32Array(seaCells).fill(Number.POSITIVE_INFINITY);
  const { wetCells } = model;
  const record = () => {
    const t = model.timeS;
    for (const cell of wetCells) {
      const value = model.eta[cell] ?? 0;
      if (value > (seaMax[cell] ?? 0)) seaMax[cell] = value;
      if (
        seaArrival[cell] === Number.POSITIVE_INFINITY &&
        Math.abs(value - (uplift[cell] ?? 0)) >= ARRIVAL_THRESHOLD_M
      ) {
        seaArrival[cell] = t;
      }
    }
  };

  record();
  writeFrame(0);
  let frame = 1;
  while (frame < frameCount) {
    model.step();
    record();
    // Frames take the first state at or after their time (dt is about 2 s).
    while (frame < frameCount && model.timeS >= frame * frameIntervalS) writeFrame(frame++);
  }

  const maxEtaM = Float32Array.from(members, (cells) =>
    cells.reduce((max, cell) => Math.max(max, seaMax[cell] ?? 0), 0),
  );
  const arrivalS = Float32Array.from(members, (cells) =>
    cells.reduce(
      (min, cell) => Math.min(min, seaArrival[cell] ?? Number.POSITIVE_INFINITY),
      Infinity,
    ),
  );

  return {
    scenarioId: scenario.id,
    durationS,
    frameIntervalS,
    frameCount,
    grid: display,
    wetCells: Int32Array.from(displayCells),
    framesMm,
    maxEtaM,
    arrivalS,
    coast: coastalImpacts(sea, wet, seaMax, seaArrival, input.districtCells),
    source: { slipM: averageSlipM(rupture.mw, rupture.areaKm2), maxUpliftM, minUpliftM },
    computeMs: performance.now() - started,
  };
}

/** Per district: earliest arrival and highest sea surface over its coastal sea cells. */
function coastalImpacts(
  sea: GridSpec,
  wet: Uint8Array,
  seaMax: Float32Array,
  seaArrival: Float32Array,
  districts: { spec: GridSpec; values: Float32Array },
): CoastalTsunami[] {
  const byIndex = new Map<number, CoastalTsunami>();
  for (let row = 0; row < sea.ny; row++) {
    for (let col = 0; col < sea.nx; col++) {
      const cell = row * sea.nx + col;
      if (!wet[cell]) continue;
      for (const [r, c] of [
        [row - 1, col],
        [row + 1, col],
        [row, col - 1],
        [row, col + 1],
      ] as const) {
        if (r < 0 || r >= sea.ny || c < 0 || c >= sea.nx || wet[r * sea.nx + c]) continue;
        const landLon = sea.west + (c + 0.5) * sea.dLon;
        const landLat = sea.north - (r + 0.5) * sea.dLat;
        const districtCell = cellIndex(districts.spec, landLon, landLat);
        const index = districts.values[districtCell] ?? Number.NaN;
        if (districtCell < 0 || Number.isNaN(index)) continue;
        const lon = sea.west + (col + 0.5) * sea.dLon;
        const lat = sea.north - (row + 0.5) * sea.dLat;
        const maxEtaM = seaMax[cell] ?? 0;
        const arrivalS = seaArrival[cell] ?? Number.POSITIVE_INFINITY;
        const current = byIndex.get(index);
        if (!current) {
          byIndex.set(index, { index, arrivalS, maxEtaM, lon, lat });
        } else {
          current.arrivalS = Math.min(current.arrivalS, arrivalS);
          if (maxEtaM > current.maxEtaM) Object.assign(current, { maxEtaM, lon, lat });
        }
        break;
      }
    }
  }
  return [...byIndex.values()].sort((a, b) => b.maxEtaM - a.maxEtaM);
}
