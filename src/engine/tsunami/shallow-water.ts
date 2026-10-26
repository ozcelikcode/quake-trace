import { EARTH_RADIUS_KM } from '@/lib/math/geo';
import type { GridSpec } from '@/types/grid';

/**
 * Linear shallow-water equations on a staggered (Arakawa C) grid with volume fluxes, stepped
 * forward-backward as in the linear TUNAMI-N1 scheme (Imamura, Yalçıner and Özyurt, 2006,
 * "Tsunami modelling manual", IOC/UNESCO):
 *
 *   ∂η/∂t + ∂M/∂x + ∂N/∂y = 0,   ∂M/∂t + g·h·∂η/∂x = 0,   ∂N/∂t + g·h·∂η/∂y = 0.
 *
 * - Geometry: each grid row is a local Cartesian strip, dx = R·Δλ·cos φ of the row and
 *   dy = R·Δφ; the cos φ variation inside the divergence is neglected (about 1.5 % across the
 *   Marmara Sea).
 * - Land is a wall: faces between a wet and a dry cell carry no flux. Water shallower than
 *   `MIN_DEPTH_M` is deepened to it (no run-up; the linear equations do not hold at the shore).
 * - The grid edges are open: an outward flux of √(g·h)·η leaves through them (first-order
 *   radiation condition).
 * - Time step from the CFL condition of the scheme, dt ≤ dx_min / √(2·g·h_max).
 */

export const GRAVITY = 9.81;
const MIN_DEPTH_M = 10;
const CFL = 0.9;
const RAD = Math.PI / 180;

export class LinearShallowWater {
  readonly spec: GridSpec;
  readonly dtS: number;
  /** Sea-surface elevation per grid cell, m (row-major, north-up). */
  readonly eta: Float32Array;
  /** Wet cells, as grid indices. */
  readonly wetCells: Int32Array;
  #time = 0;
  // Padded with a one-cell halo so every cell has four faces.
  readonly #nxp: number;
  readonly #etaP: Float32Array;
  /** Flux through the east face of each padded cell, m²/s. */
  readonly #fluxE: Float32Array;
  /** Flux through the south face of each padded cell (southward positive), m²/s. */
  readonly #fluxS: Float32Array;
  readonly #wetP: Int32Array;
  readonly #wetInvDx: Float32Array;
  readonly #invDy: number;
  /** Interior faces between two wet cells, and g·dt·h/Δ for each. */
  readonly #eastFaces: Int32Array;
  readonly #eastCoef: Float32Array;
  readonly #southFaces: Int32Array;
  readonly #southCoef: Float32Array;
  /** Open faces: padded cell, wave speed √(g·h) and side (0 west, 1 east, 2 north, 3 south). */
  readonly #openCells: Int32Array;
  readonly #openSpeed: Float32Array;
  readonly #openSide: Uint8Array;

  /** `depthM` > 0 marks water (depth in m); 0 or NaN marks land. */
  constructor(spec: GridSpec, depthM: Float32Array) {
    this.spec = spec;
    const { nx, ny } = spec;
    const nxp = nx + 2;
    this.#nxp = nxp;
    const size = nxp * (ny + 2);
    const depth = new Float32Array(size);
    const wet: number[] = [];
    let maxDepth = 0;
    for (let row = 0; row < ny; row++) {
      for (let col = 0; col < nx; col++) {
        const value = depthM[row * nx + col] ?? Number.NaN;
        if (!(value > 0)) continue;
        const h = Math.max(MIN_DEPTH_M, value);
        const padded = (row + 1) * nxp + col + 1;
        depth[padded] = h;
        wet.push(padded);
        maxDepth = Math.max(maxDepth, h);
      }
    }
    const dy = EARTH_RADIUS_KM * 1000 * spec.dLat * RAD;
    const dxOf = (paddedRow: number) => {
      const lat = spec.north - (paddedRow - 1 + 0.5) * spec.dLat;
      return EARTH_RADIUS_KM * 1000 * spec.dLon * RAD * Math.cos(lat * RAD);
    };
    const dxMin = Math.min(dxOf(1), dxOf(ny));
    this.dtS = maxDepth > 0 ? (CFL * Math.min(dxMin, dy)) / Math.sqrt(2 * GRAVITY * maxDepth) : 1;
    const dt = this.dtS;

    this.#etaP = new Float32Array(size);
    this.#fluxE = new Float32Array(size);
    this.#fluxS = new Float32Array(size);
    this.#wetP = Int32Array.from(wet);
    this.#wetInvDx = Float32Array.from(wet, (padded) => 1 / dxOf(Math.floor(padded / nxp)));
    this.#invDy = 1 / dy;
    this.wetCells = Int32Array.from(wet, (padded) => {
      const row = Math.floor(padded / nxp) - 1;
      return row * nx + (padded % nxp) - 1;
    });
    this.eta = new Float32Array(nx * ny);

    const eastFaces: number[] = [];
    const eastCoef: number[] = [];
    const southFaces: number[] = [];
    const southCoef: number[] = [];
    const openCells: number[] = [];
    const openSpeed: number[] = [];
    const openSide: number[] = [];
    const isHalo = (padded: number) => {
      const row = Math.floor(padded / nxp);
      const col = padded % nxp;
      return row === 0 || row === ny + 1 || col === 0 || col === nx + 1;
    };
    for (const cell of wet) {
      const h = depth[cell] ?? 0;
      const neighbours = [cell - 1, cell + 1, cell - nxp, cell + nxp];
      neighbours.forEach((neighbour, side) => {
        if (isHalo(neighbour)) {
          openCells.push(cell);
          openSpeed.push(Math.sqrt(GRAVITY * h));
          openSide.push(side);
        }
      });
      const east = cell + 1;
      if ((depth[east] ?? 0) > 0) {
        eastFaces.push(cell);
        eastCoef.push((GRAVITY * dt * (h + (depth[east] ?? 0))) / 2 / dxOf(Math.floor(cell / nxp)));
      }
      const south = cell + nxp;
      if ((depth[south] ?? 0) > 0) {
        southFaces.push(cell);
        southCoef.push((GRAVITY * dt * (h + (depth[south] ?? 0))) / 2 / dy);
      }
    }
    this.#eastFaces = Int32Array.from(eastFaces);
    this.#eastCoef = Float32Array.from(eastCoef);
    this.#southFaces = Int32Array.from(southFaces);
    this.#southCoef = Float32Array.from(southCoef);
    this.#openCells = Int32Array.from(openCells);
    this.#openSpeed = Float32Array.from(openSpeed);
    this.#openSide = Uint8Array.from(openSide);
  }

  get timeS(): number {
    return this.#time;
  }

  /** Sets the initial surface (m per grid cell, dry cells ignored) and rests the water. */
  setInitialSurface(eta: Float32Array): void {
    this.#etaP.fill(0);
    this.#fluxE.fill(0);
    this.#fluxS.fill(0);
    const wet = this.#wetP;
    for (let k = 0; k < wet.length; k++) {
      this.#etaP[wet[k] ?? 0] = eta[this.wetCells[k] ?? 0] ?? 0;
    }
    this.#time = 0;
    this.#publish();
  }

  step(): void {
    const dt = this.dtS;
    const nxp = this.#nxp;
    const eta = this.#etaP;
    const fluxE = this.#fluxE;
    const fluxS = this.#fluxS;

    // Continuity with the current fluxes.
    const wet = this.#wetP;
    const invDx = this.#wetInvDx;
    const invDy = this.#invDy;
    for (let k = 0; k < wet.length; k++) {
      const c = wet[k] ?? 0;
      const divergence =
        ((fluxE[c] ?? 0) - (fluxE[c - 1] ?? 0)) * (invDx[k] ?? 0) +
        ((fluxS[c] ?? 0) - (fluxS[c - nxp] ?? 0)) * invDy;
      eta[c] = (eta[c] ?? 0) - dt * divergence;
    }

    // Momentum with the new surface (forward-backward).
    const eastFaces = this.#eastFaces;
    const eastCoef = this.#eastCoef;
    for (let k = 0; k < eastFaces.length; k++) {
      const c = eastFaces[k] ?? 0;
      fluxE[c] = (fluxE[c] ?? 0) - (eastCoef[k] ?? 0) * ((eta[c + 1] ?? 0) - (eta[c] ?? 0));
    }
    const southFaces = this.#southFaces;
    const southCoef = this.#southCoef;
    for (let k = 0; k < southFaces.length; k++) {
      const c = southFaces[k] ?? 0;
      fluxS[c] = (fluxS[c] ?? 0) - (southCoef[k] ?? 0) * ((eta[c + nxp] ?? 0) - (eta[c] ?? 0));
    }

    // Open edges: the wave leaves at √(g·h).
    const openCells = this.#openCells;
    for (let k = 0; k < openCells.length; k++) {
      const c = openCells[k] ?? 0;
      const outflow = (this.#openSpeed[k] ?? 0) * (eta[c] ?? 0);
      switch (this.#openSide[k]) {
        case 0:
          fluxE[c - 1] = -outflow;
          break;
        case 1:
          fluxE[c] = outflow;
          break;
        case 2:
          fluxS[c - nxp] = -outflow;
          break;
        default:
          fluxS[c] = outflow;
      }
    }

    this.#time += dt;
    this.#publish();
  }

  /** Copies the padded surface to `eta` on the grid. */
  #publish(): void {
    const wet = this.#wetP;
    for (let k = 0; k < wet.length; k++) {
      this.eta[this.wetCells[k] ?? 0] = this.#etaP[wet[k] ?? 0] ?? 0;
    }
  }
}
