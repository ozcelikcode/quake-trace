/**
 * Vertical surface displacement of a rectangular dislocation in an elastic half-space
 * (Okada, 1985, Bull. Seismol. Soc. Am. 75(4), 1135–1154, eqs. 25–30, uz terms with the
 * Chinnery notation f(ξ, η)‖ = f(x, p) − f(x, p − W) − f(x − L, p) + f(x − L, p − W)).
 * Ported from the GeoClaw implementation (clawpack/geoclaw `dtopotools.py`, `_strike_slip`
 * and `_dip_slip`, commit 8155d73) and checked against Okada's Table 2.
 *
 * Okada's coordinates: x along strike from the fault's start, y horizontal and normal to strike
 * towards the up-dip side, z up; the fault's lower edge lies at depth d below the x axis and
 * the fault extends L along strike and W up dip. Slip follows Aki and Richards: strike slip
 * positive left-lateral, dip slip positive reverse.
 */

/** μ / (λ + μ) for a Poisson solid (λ = μ), as in Okada's Table 2 and GeoClaw. */
const MU_RATIO = 0.5;
/** Below this |cos δ| the vertical-fault limits of I4 and I5 are used. */
const VERTICAL_COS = 1e-6;
const EPSILON = 1e-12;

function strikeSlipTerm(xi: number, eta: number, q: number, sin: number, cos: number): number {
  const r = Math.sqrt(xi * xi + eta * eta + q * q);
  const dTilde = eta * sin - q * cos;
  // Okada (1992): where R + η vanishes, 1/(R + η) → 0 and ln(R + η) → −ln(R − η).
  const rPlusEta = r + eta;
  const inverse = Math.abs(rPlusEta) < EPSILON ? 0 : 1 / rPlusEta;
  const logREta = Math.abs(rPlusEta) < EPSILON ? -Math.log(r - eta) : Math.log(rPlusEta);
  const i4 =
    Math.abs(cos) < VERTICAL_COS
      ? (-MU_RATIO * q) / (r + dTilde)
      : (MU_RATIO / cos) * (Math.log(r + dTilde) - sin * logREta);
  return ((dTilde * q) / r) * inverse + q * sin * inverse + i4 * sin;
}

function dipSlipTerm(xi: number, eta: number, q: number, sin: number, cos: number): number {
  const r = Math.sqrt(xi * xi + eta * eta + q * q);
  const dTilde = eta * sin - q * cos;
  const x = Math.sqrt(xi * xi + q * q);
  const rPlusXi = r + xi;
  const inverse = Math.abs(rPlusXi) < EPSILON ? 0 : 1 / rPlusXi;
  // The arctangent term vanishes with q (Okada, 1985, after eq. 30).
  const angle = Math.abs(q) < EPSILON ? 0 : Math.atan((xi * eta) / (q * r));
  let i5: number;
  if (Math.abs(cos) < VERTICAL_COS) {
    i5 = (-MU_RATIO * xi * sin) / (r + dTilde);
  } else if (Math.abs(xi) < EPSILON) {
    i5 = 0;
  } else {
    i5 =
      ((MU_RATIO * 2) / cos) *
      Math.atan((eta * (x + q * cos) + x * (r + x) * sin) / (xi * (r + x) * cos));
  }
  return ((dTilde * q) / r) * inverse + sin * angle - i5 * sin * cos;
}

/**
 * Vertical displacement uz at surface point (x, y), in the units of the slip (lengths in any
 * consistent unit).
 */
export function okadaUz(
  x: number,
  y: number,
  depth: number,
  dipDeg: number,
  length: number,
  width: number,
  strikeSlip: number,
  dipSlip: number,
): number {
  const dip = (dipDeg * Math.PI) / 180;
  const sin = Math.sin(dip);
  const cos = Math.cos(dip);
  const p = y * cos + depth * sin;
  const q = y * sin - depth * cos;
  const chinnery = (term: typeof strikeSlipTerm) =>
    term(x, p, q, sin, cos) -
    term(x, p - width, q, sin, cos) -
    term(x - length, p, q, sin, cos) +
    term(x - length, p - width, q, sin, cos);
  return (
    (-strikeSlip / (2 * Math.PI)) * chinnery(strikeSlipTerm) -
    (dipSlip / (2 * Math.PI)) * chinnery(dipSlipTerm)
  );
}
