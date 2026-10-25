/**
 * Point-source Fourier amplitude spectrum of ground acceleration for the stochastic method
 * (Boore, 2003, "Simulation of ground motion using the stochastic method", Pure Appl. Geophys.
 * 160:635–676): Brune ω² source × geometric spreading × anelastic attenuation × site.
 *
 * S-wave parameters are the western North America defaults of Campbell (2003, Bull. Seismol.
 * Soc. Am. 93:1012–1033), an active shallow crust like the Marmara region, as implemented in
 * pyrvt v0.8.1 (`SourceTheoryMotion`, region "wna"): β = 3.5 km/s, ρ = 2.8 g/cm³, Δσ = 100 bar,
 * Q(f) = 180·f^0.45, κ0 = 0.04 s, spreading R⁻¹ to 40 km and R⁻⁰·⁵ beyond, duration
 * 1/f0 + 0.05·R, and the crustal amplification table below.
 *
 * The stochastic method models the S phase. The P phase that precedes it here uses the same
 * model with P-wave terms: far-field double-couple amplitudes scale with R/c³ (Aki and
 * Richards, 2002), so P/S = (0.52/0.63)·(β/α)³ with the rms radiation coefficients of Boore and
 * Boatwright (1984); the corner frequency is higher by 0.32/0.21 (Madariaga, 1976); and a
 * Poisson solid gives α = √3·β. P shares the S-wave path attenuation, κ0 and crustal
 * amplification, a simplification that keeps P below S on the horizontals at all distances.
 * Absolute levels are rescaled to the GMPE median later, so only spectral shapes and the P/S
 * ratio matter.
 */

export type Phase = 'P' | 'S';

const SHEAR_VELOCITY_KMS = 3.5;
const DENSITY_GCM3 = 2.8;
const STRESS_DROP_BAR = 100;
const Q0 = 180;
const Q_POWER = 0.45;
const KAPPA_S = 0.04;
const SPREADING_CROSSOVER_KM = 40;
const PATH_DURATION_PER_KM = 0.05;

const P_VELOCITY_KMS = Math.sqrt(3) * SHEAR_VELOCITY_KMS;
const RADIATION = { P: 0.52, S: 0.63 } as const;
const CORNER_FACTOR = { P: 0.32 / 0.21, S: 1 } as const;
const FREE_SURFACE = 2;
/** Share of S motion on one horizontal component (Boore, 2003). */
export const HORIZONTAL_PARTITION = Math.SQRT1_2;

/**
 * Campbell (2003) western North America crustal amplification (quarter-wavelength), linear in
 * amplitude against ln f and constant beyond the ends.
 */
// prettier-ignore
const AMPLIFICATION_FREQUENCIES_HZ = [0.01, 0.09, 0.16, 0.51, 0.84, 1.25, 2.26, 3.17, 6.05, 16.6, 61.2, 100];
// prettier-ignore
const AMPLIFICATION = [1.0, 1.1, 1.18, 1.42, 1.58, 1.74, 2.06, 2.25, 2.58, 3.13, 4.0, 4.4];
const LN_AMPLIFICATION_FREQUENCIES = AMPLIFICATION_FREQUENCIES_HZ.map(Math.log);

/** Hanks and Kanamori (1979), in the form used by pyrvt: M0 = 10^(1.5·(Mw + 10.7)) dyne·cm. */
export function seismicMomentDyneCm(mw: number): number {
  return 10 ** (1.5 * (mw + 10.7));
}

/** Brune (1970) corner frequency, f0 = 4.9·10⁶·β·(Δσ/M0)^(1/3) (β km/s, Δσ bar, M0 dyne·cm). */
export function cornerFrequencyHz(mw: number, phase: Phase): number {
  const sCorner =
    4.9e6 * SHEAR_VELOCITY_KMS * (STRESS_DROP_BAR / seismicMomentDyneCm(mw)) ** (1 / 3);
  return sCorner * CORNER_FACTOR[phase];
}

/** Duration of the radiated motion: source (1/f0) plus path (0.05 s/km). */
export function excitationDurationS(mw: number, distanceKm: number, phase: Phase): number {
  return 1 / cornerFrequencyHz(mw, phase) + PATH_DURATION_PER_KM * distanceKm;
}

export function geometricSpreading(distanceKm: number): number {
  if (distanceKm <= SPREADING_CROSSOVER_KM) return 1 / distanceKm;
  return (1 / SPREADING_CROSSOVER_KM) * Math.sqrt(SPREADING_CROSSOVER_KM / distanceKm);
}

export function crustalAmplification(frequencyHz: number): number {
  const lnF = Math.log(frequencyHz);
  const last = LN_AMPLIFICATION_FREQUENCIES.length - 1;
  if (lnF <= (LN_AMPLIFICATION_FREQUENCIES[0] ?? 0)) return AMPLIFICATION[0] ?? 1;
  if (lnF >= (LN_AMPLIFICATION_FREQUENCIES[last] ?? 0)) return AMPLIFICATION[last] ?? 1;
  let i = 1;
  while ((LN_AMPLIFICATION_FREQUENCIES[i] ?? Number.POSITIVE_INFINITY) < lnF) i++;
  const x0 = LN_AMPLIFICATION_FREQUENCIES[i - 1] ?? 0;
  const x1 = LN_AMPLIFICATION_FREQUENCIES[i] ?? 0;
  const y0 = AMPLIFICATION[i - 1] ?? 1;
  const y1 = AMPLIFICATION[i] ?? 1;
  return y0 + ((lnF - x0) / (x1 - x0)) * (y1 - y0);
}

/**
 * Acceleration Fourier amplitude (cm/s) for one phase at a distance, as a function of frequency.
 * S includes the partition onto one horizontal component; P is the full motion along the ray.
 */
export function accelerationSpectrum(
  phase: Phase,
  mw: number,
  distanceKm: number,
): (frequencyHz: number) => number {
  const velocity = phase === 'P' ? P_VELOCITY_KMS : SHEAR_VELOCITY_KMS;
  const partition = phase === 'S' ? HORIZONTAL_PARTITION : 1;
  // 1e-20 converts dyne·cm, g/cm³ and km/s (R0 = 1 km) into cm/s (Boore, 2003, eq. 7).
  const constant =
    ((RADIATION[phase] * FREE_SURFACE * partition) / (4 * Math.PI * DENSITY_GCM3 * velocity ** 3)) *
    1e-20;
  const level = constant * seismicMomentDyneCm(mw) * geometricSpreading(distanceKm);
  const corner = cornerFrequencyHz(mw, phase);

  return (frequencyHz) => {
    if (frequencyHz <= 0) return 0;
    const omega = 2 * Math.PI * frequencyHz;
    const source = 1 / (1 + (frequencyHz / corner) ** 2);
    const q = Q0 * frequencyHz ** Q_POWER;
    const path = Math.exp((-Math.PI * frequencyHz * distanceKm) / (q * SHEAR_VELOCITY_KMS));
    const site = crustalAmplification(frequencyHz) * Math.exp(-Math.PI * KAPPA_S * frequencyHz);
    return omega * omega * level * source * path * site;
  };
}
