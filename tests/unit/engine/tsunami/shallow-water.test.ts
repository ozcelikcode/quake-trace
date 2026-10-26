import { describe, expect, it } from 'vitest';

import { GRAVITY, LinearShallowWater } from '@/engine/tsunami/shallow-water';
import { EARTH_RADIUS_KM } from '@/lib/math/geo';

const RAD = Math.PI / 180;

/** A grid on the equator with cells of about 556 m. */
function equatorialGrid(nx: number, ny: number) {
  return { west: 0, north: (ny * 0.005) / 2, dLon: 0.005, dLat: 0.005, nx, ny };
}

function crestColumn(model: LinearShallowWater, row: number, fromCol: number): number {
  const { nx } = model.spec;
  let best = fromCol;
  for (let col = fromCol; col < nx; col++) {
    if ((model.eta[row * nx + col] ?? 0) > (model.eta[row * nx + best] ?? 0)) best = col;
  }
  return best;
}

describe('linear shallow-water solver', () => {
  it('carries a long wave at √(g·h) over a flat bottom', () => {
    // A channel of 400 cells × 3 rows, 100 m deep, closed along its sides by land rows.
    const spec = equatorialGrid(400, 5);
    const depth = new Float32Array(spec.nx * spec.ny);
    for (let row = 1; row < 4; row++) depth.fill(100, row * spec.nx, (row + 1) * spec.nx);
    const model = new LinearShallowWater(spec, depth);
    const initial = new Float32Array(depth.length);
    for (let row = 1; row < 4; row++) {
      for (let col = 0; col < spec.nx; col++) {
        initial[row * spec.nx + col] = Math.exp(-(((col - 100) / 6) ** 2));
      }
    }
    model.setInitialSurface(initial);
    const speed = Math.sqrt(GRAVITY * 100);
    const steps = Math.round(1500 / model.dtS);
    for (let i = 0; i < steps; i++) model.step();
    const dx = EARTH_RADIUS_KM * 1000 * spec.dLon * RAD;
    const expectedCol = 100 + (speed * model.timeS) / dx;
    // The eastward half of the hump, within one cell.
    expect(Math.abs(crestColumn(model, 2, 120) - expectedCol)).toBeLessThanOrEqual(1);
    expect(model.eta[2 * spec.nx + crestColumn(model, 2, 120)]).toBeCloseTo(0.5, 1);
  });

  it('conserves volume in a closed basin', () => {
    const spec = equatorialGrid(60, 60);
    const depth = new Float32Array(spec.nx * spec.ny);
    for (let row = 5; row < 55; row++) {
      for (let col = 5; col < 55; col++) depth[row * spec.nx + col] = 50 + row * 10;
    }
    const model = new LinearShallowWater(spec, depth);
    const initial = new Float32Array(depth.length);
    for (let row = 0; row < spec.ny; row++) {
      for (let col = 0; col < spec.nx; col++) {
        initial[row * spec.nx + col] = Math.exp(-((row - 20) ** 2 + (col - 30) ** 2) / 20);
      }
    }
    model.setInitialSurface(initial);
    const volume = () => {
      let sum = 0;
      for (const cell of model.wetCells) sum += model.eta[cell] ?? 0;
      return sum;
    };
    const before = volume();
    for (let i = 0; i < 500; i++) model.step();
    expect(volume()).toBeCloseTo(before, 3);
    // The hump has spread out.
    expect(model.eta[20 * spec.nx + 30]).toBeLessThan(0.5);
  });

  it('lets waves leave through the open grid edges', () => {
    const spec = equatorialGrid(80, 80);
    const depth = new Float32Array(spec.nx * spec.ny).fill(200);
    const model = new LinearShallowWater(spec, depth);
    const initial = new Float32Array(depth.length);
    for (let row = 0; row < spec.ny; row++) {
      for (let col = 0; col < spec.nx; col++) {
        initial[row * spec.nx + col] = Math.exp(-((row - 40) ** 2 + (col - 40) ** 2) / 10);
      }
    }
    model.setInitialSurface(initial);
    const energy = () => model.eta.reduce((sum, value) => sum + value * value, 0);
    const before = energy();
    // Long enough to cross the 44 km grid at 44 m/s about twice.
    const steps = Math.round(2000 / model.dtS);
    for (let i = 0; i < steps; i++) model.step();
    expect(energy()).toBeLessThan(0.05 * before);
  });
});
