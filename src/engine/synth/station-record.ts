import type { Random } from '../random/random';
import { accelerationSpectrum, excitationDurationS } from './point-source';
import { stochasticMotions } from './stochastic';

/**
 * Three-component synthetic accelerogram at one station: a P phase followed by the S phase, each
 * a stochastic-method realization (Boore, 2003) starting at the station's first arrival from the
 * finite rupture, then scaled to the GMPE median.
 *
 * - P travels along the ray: cos i on the vertical, sin i on the radial horizontal, where the
 *   incidence angle i follows from Snell's law at the near-surface P velocity.
 * - S arrives on both horizontals as independent realizations, and on the vertical at 2/3 of the
 *   horizontal level (Newmark and Hall, 1982).
 * - All components share one scale factor that sets the geometric mean of the horizontal peaks,
 *   the component definition of ASB14 (OpenQuake `IMC.GEOMETRIC_MEAN`), to the target PGA.
 * - A small Gaussian noise floor is added everywhere, so records are never flat and the
 *   STA/LTA trigger sees realistic pre-event noise.
 */

export const VERTICAL_TO_HORIZONTAL = 2 / 3;
/**
 * Assumed ambient noise floor, cm/s² rms (about 50 µg). A display and trigger assumption, not
 * calibrated against station noise.
 */
export const NOISE_RMS_CMS2 = 0.05;

export interface StationSynthesisInput {
  mw: number;
  /** Closest distance to the rupture, km (distance of the spectral model). */
  distanceKm: number;
  pArrivalS: number;
  sArrivalS: number;
  /** Propagation azimuth at the station (from the epicentre), degrees clockwise from north. */
  azimuthDeg: number;
  /** Sine of the P incidence angle at the surface. */
  pIncidenceSine: number;
  /** Geometric mean of the horizontal peaks, cm/s². */
  targetPgaCmS2: number;
}

export interface RecordTiming {
  /** Time of the first sample, s after origin. */
  startS: number;
  sampleRateHz: number;
  samples: number;
}

export interface ThreeComponents {
  z: Float64Array;
  n: Float64Array;
  e: Float64Array;
}

function addAt(target: Float64Array, motion: Float64Array, onset: number, scale: number): void {
  const from = Math.max(0, -onset);
  const to = Math.min(motion.length, target.length - onset);
  for (let i = from; i < to; i++) {
    target[onset + i] = (target[onset + i] ?? 0) + (motion[i] ?? 0) * scale;
  }
}

function peak(values: Float64Array): number {
  let max = 0;
  for (const value of values) max = Math.max(max, Math.abs(value));
  return max;
}

/** Fills `out` (each component `timing.samples` long, zeroed by this call). */
export function synthesizeStation(
  random: Random,
  input: StationSynthesisInput,
  timing: RecordTiming,
  out: ThreeComponents,
): void {
  const { z, n, e } = out;
  z.fill(0);
  n.fill(0);
  e.fill(0);
  const rate = timing.sampleRateHz;
  const onset = (timeS: number) => Math.round((timeS - timing.startS) * rate);

  const sSpectrum = accelerationSpectrum('S', input.mw, input.distanceKm);
  const sDuration = excitationDurationS(input.mw, input.distanceKm, 'S');
  const sOnset = onset(input.sArrivalS);
  const [sNorth, sEast, sVertical] = stochasticMotions(random, sSpectrum, sDuration, rate, 3);
  if (!sNorth || !sEast || !sVertical) throw new Error('expected three S realizations');
  addAt(n, sNorth, sOnset, 1);
  addAt(e, sEast, sOnset, 1);
  addAt(z, sVertical, sOnset, VERTICAL_TO_HORIZONTAL);

  const pSpectrum = accelerationSpectrum('P', input.mw, input.distanceKm);
  const pDuration = excitationDurationS(input.mw, input.distanceKm, 'P');
  const [p] = stochasticMotions(random, pSpectrum, pDuration, rate, 1);
  if (!p) throw new Error('expected one P realization');
  const sine = Math.min(1, Math.max(0, input.pIncidenceSine));
  const cosine = Math.sqrt(1 - sine * sine);
  const azimuth = (input.azimuthDeg * Math.PI) / 180;
  const pOnset = onset(input.pArrivalS);
  addAt(z, p, pOnset, cosine);
  addAt(n, p, pOnset, sine * Math.cos(azimuth));
  addAt(e, p, pOnset, sine * Math.sin(azimuth));

  const horizontal = Math.sqrt(peak(n) * peak(e));
  const scale = horizontal > 0 ? input.targetPgaCmS2 / horizontal : 0;
  for (const component of [z, n, e]) {
    for (let i = 0; i < component.length; i++) {
      component[i] = (component[i] ?? 0) * scale + random.normal() * NOISE_RMS_CMS2;
    }
  }
}
