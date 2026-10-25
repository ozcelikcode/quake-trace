/**
 * Akkar, Sandıkkaya and Bommer (2014), "Empirical ground-motion models for point- and
 * extended-source crustal earthquake scenarios in Europe and the Middle East", Bull. Earthquake
 * Eng. 12:359–387. Joyner–Boore distance (Rjb) model, equations 1–3, coefficients from Tables 3
 * and 4a, as implemented in OpenQuake hazardlib (`AkkarEtAlRjb2014`).
 *
 * Medians: PGA and SA in g, PGV in cm/s. Standard deviations are in natural-log units.
 */

export type IntensityMeasure = 'PGA' | 'PGV' | 'SA(0.3)' | 'SA(1.0)';

interface Coefficients {
  a1: number;
  a2: number;
  a3: number;
  a4: number;
  a5: number;
  a6: number;
  a7: number;
  a8: number;
  a9: number;
  b1: number;
  b2: number;
  /** Within-event (intra-event) standard deviation. */
  sigma: number;
  /** Between-event (inter-event) standard deviation. */
  tau: number;
}

// prettier-ignore
const COEFFICIENTS: Record<IntensityMeasure, Coefficients> = {
  PGA: {
    a1: 1.85329, a2: 0.0029, a3: -0.02807, a4: -1.23452, a5: 0.2529, a6: 7.5, a7: -0.5096,
    a8: -0.1091, a9: 0.0937, b1: -0.41997, b2: -0.28846, sigma: 0.6201, tau: 0.3501,
  },
  PGV: {
    a1: 5.61201, a2: 0.0029, a3: -0.0998, a4: -0.98388, a5: 0.2529, a6: 7.5, a7: -0.5096,
    a8: -0.0616, a9: 0.063, b1: -0.72057, b2: -0.19688, sigma: 0.6014, tau: 0.3311,
  },
  'SA(0.3)': {
    a1: 2.3015, a2: 0.0029, a3: -0.05672, a4: -1.17072, a5: 0.2529, a6: 7.5, a7: -0.5096,
    a8: 0, a9: 0.0469, b1: -0.82609, b2: -0.4573, sigma: 0.6599, tau: 0.3816,
  },
  'SA(1.0)': {
    a1: 0.52349, a2: 0.0029, a3: -0.14345, a4: -0.81838, a5: 0.2529, a6: 7.5, a7: -0.5096,
    a8: 0, a9: 0, b1: -1.01331, b2: -0.28702, sigma: 0.6787, tau: 0.3943,
  },
};

/** Reference magnitude c1 (shared by all periods). */
const C1 = 6.75;
/** Site model constants: reference and limiting Vs30 (m/s), c and n of equation 3a. */
const V_REF = 750;
const V_CON = 1000;
const C = 2.5;
const N = 3.2;

export interface Asb14Input {
  mw: number;
  rjbKm: number;
  vs30: number;
  rakeDeg: number;
}

/** Equations 2a/2b: ln of the median on the reference site. */
function lnReferenceMedian(k: Coefficients, input: Asb14Input): number {
  const { mw, rjbKm, rakeDeg } = input;
  const linear = mw <= C1 ? k.a2 * (mw - C1) : k.a7 * (mw - C1);
  const quadratic = k.a3 * (8.5 - mw) ** 2;
  const distance = (k.a4 + k.a5 * (mw - C1)) * Math.log(Math.sqrt(rjbKm * rjbKm + k.a6 * k.a6));
  const normal = rakeDeg > -135 && rakeDeg < -45 ? 1 : 0;
  const reverse = rakeDeg > 45 && rakeDeg < 135 ? 1 : 0;
  return k.a1 + linear + quadratic + distance + k.a8 * normal + k.a9 * reverse;
}

/** Equations 3a–3c: nonlinear site amplification, driven by the reference-site median PGA (g). */
function lnSiteAmplification(k: Coefficients, vs30: number, referencePgaG: number): number {
  if (vs30 < V_REF) {
    const ratio = vs30 / V_REF;
    return (
      k.b1 * Math.log(ratio) +
      k.b2 * Math.log((referencePgaG + C * ratio ** N) / ((referencePgaG + C) * ratio ** N))
    );
  }
  return k.b1 * Math.log(Math.min(vs30, V_CON) / V_REF);
}

/** ln of the median ground motion for one site. */
export function asb14LnMedian(measure: IntensityMeasure, input: Asb14Input): number {
  const referencePgaG = Math.exp(lnReferenceMedian(COEFFICIENTS.PGA, input));
  const k = COEFFICIENTS[measure];
  return lnReferenceMedian(k, input) + lnSiteAmplification(k, input.vs30, referencePgaG);
}

/** Total standard deviation in natural-log units, √(σ² + τ²). */
export function asb14TotalSigma(measure: IntensityMeasure): number {
  const k = COEFFICIENTS[measure];
  return Math.hypot(k.sigma, k.tau);
}
