import { describe, expect, it } from 'vitest';

import { createRandom } from '@/engine/random/random';
import {
  synthesizeStation,
  type StationSynthesisInput,
  type ThreeComponents,
} from '@/engine/synth/station-record';

const timing = { startS: -10, sampleRateHz: 100, samples: 6000 };
const input: StationSynthesisInput = {
  mw: 6.5,
  distanceKm: 20,
  pArrivalS: 3.5,
  sArrivalS: 6,
  // Waves travel due east, so the radial P motion lands on the east component only.
  azimuthDeg: 90,
  pIncidenceSine: 0.1,
  targetPgaCmS2: 200,
};

function synthesize(seed: number): ThreeComponents {
  const out = {
    z: new Float64Array(timing.samples),
    n: new Float64Array(timing.samples),
    e: new Float64Array(timing.samples),
  };
  synthesizeStation(createRandom(seed), input, timing, out);
  return out;
}

const index = (timeS: number) => Math.round((timeS - timing.startS) * timing.sampleRateHz);
const peak = (values: Float64Array, fromS: number, toS: number) =>
  values.subarray(index(fromS), index(toS)).reduce((max, v) => Math.max(max, Math.abs(v)), 0);

describe('three-component station record', () => {
  const record = synthesize(11);
  const end = timing.startS + timing.samples / timing.sampleRateHz;

  it('sets the geometric mean of the horizontal peaks to the target PGA', () => {
    const horizontal = Math.sqrt(peak(record.n, -10, end) * peak(record.e, -10, end));
    expect(horizontal / input.targetPgaCmS2).toBeCloseTo(1, 2);
  });

  it('holds only the noise floor before the P arrival', () => {
    for (const component of [record.z, record.n, record.e]) {
      expect(peak(component, -10, input.pArrivalS)).toBeLessThan(0.3);
    }
  });

  it('projects P onto the vertical and the radial (east) component before S arrives', () => {
    const vertical = peak(record.z, input.pArrivalS, input.sArrivalS);
    const radial = peak(record.e, input.pArrivalS, input.sArrivalS);
    expect(vertical).toBeGreaterThan(5 * radial);
    expect(radial).toBeGreaterThan(0.3);
    expect(peak(record.n, input.pArrivalS, input.sArrivalS)).toBeLessThan(0.3);
  });

  it('is deterministic per seed', () => {
    expect(synthesize(11)).toEqual(record);
    expect(synthesize(12).n).not.toEqual(record.n);
  });
});
