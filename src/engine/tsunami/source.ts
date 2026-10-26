import { bearingDeg, destination, EARTH_RADIUS_KM, haversineKm } from '@/lib/math/geo';
import type { GridSpec } from '@/types/grid';
import type { LonLat } from '@/types/scenario';

import { seismicMomentDyneCm } from '../synth/point-source';
import { okadaUz } from './okada';

/**
 * Initial sea surface of a tsunami: the vertical seafloor displacement of the rupture (Okada,
 * 1985), summed over one rectangle per segment of the ruptured trace with uniform slip, and
 * copied to the sea surface (instantaneous rupture; horizontal-motion and Kajiura smoothing
 * effects are not applied).
 *
 * Average slip D = M0 / (μ·A): M0 from Hanks and Kanamori (1979) as in `synth/point-source.ts`,
 * μ = 3×10¹⁰ Pa, the rigidity used by Wells and Coppersmith (1994).
 */

export const RIGIDITY_PA = 3e10;
const RAD = Math.PI / 180;
const DYNE_CM_TO_NM = 1e-7;

export interface FaultRectangle {
  /** Okada's origin: start of the lower edge (the upper edge moved down dip, strike + 90°). */
  originLon: number;
  originLat: number;
  strikeDeg: number;
  lengthKm: number;
  widthKm: number;
  dipDeg: number;
  /** Depth of the lower edge. */
  bottomDepthKm: number;
  strikeSlipM: number;
  dipSlipM: number;
}

export interface RuptureGeometry {
  mw: number;
  areaKm2: number;
  /** Upper edge of the ruptured part, at `topDepthKm`. */
  trace: readonly LonLat[];
  dipDeg: number;
  rakeDeg: number;
  topDepthKm: number;
  bottomDepthKm: number;
}

export function averageSlipM(mw: number, areaKm2: number): number {
  return (seismicMomentDyneCm(mw) * DYNE_CM_TO_NM) / (RIGIDITY_PA * areaKm2 * 1e6);
}

export function faultRectangles(rupture: RuptureGeometry): FaultRectangle[] {
  const slip = averageSlipM(rupture.mw, rupture.areaKm2);
  const widthKm = (rupture.bottomDepthKm - rupture.topDepthKm) / Math.sin(rupture.dipDeg * RAD);
  const rectangles: FaultRectangle[] = [];
  for (let i = 1; i < rupture.trace.length; i++) {
    const [lon0, lat0] = rupture.trace[i - 1] ?? [0, 0];
    const [lon1, lat1] = rupture.trace[i] ?? [0, 0];
    const lengthKm = haversineKm(lon0, lat0, lon1, lat1);
    if (lengthKm <= 0) continue;
    const strikeDeg = bearingDeg(lon0, lat0, lon1, lat1);
    const [originLon, originLat] = destination(
      lon0,
      lat0,
      strikeDeg + 90,
      widthKm * Math.cos(rupture.dipDeg * RAD),
    );
    rectangles.push({
      originLon,
      originLat,
      strikeDeg,
      lengthKm,
      widthKm,
      dipDeg: rupture.dipDeg,
      bottomDepthKm: rupture.bottomDepthKm,
      strikeSlipM: slip * Math.cos(rupture.rakeDeg * RAD),
      dipSlipM: slip * Math.sin(rupture.rakeDeg * RAD),
    });
  }
  return rectangles;
}

/** Vertical displacement (m) at a point from one rectangle, in Okada's local frame. */
export function rectangleUplift(rect: FaultRectangle, lon: number, lat: number): number {
  const east = (lon - rect.originLon) * RAD * EARTH_RADIUS_KM * Math.cos(rect.originLat * RAD);
  const north = (lat - rect.originLat) * RAD * EARTH_RADIUS_KM;
  const strike = rect.strikeDeg * RAD;
  const x = east * Math.sin(strike) + north * Math.cos(strike);
  const y = -(east * Math.cos(strike) - north * Math.sin(strike));
  return okadaUz(
    x,
    y,
    rect.bottomDepthKm,
    rect.dipDeg,
    rect.lengthKm,
    rect.widthKm,
    rect.strikeSlipM,
    rect.dipSlipM,
  );
}

/** Uplift (m) at the centre of every cell where `wet` is set; 0 elsewhere. */
export function seafloorUplift(
  rectangles: readonly FaultRectangle[],
  spec: GridSpec,
  wet: Uint8Array,
): Float32Array {
  const uplift = new Float32Array(spec.nx * spec.ny);
  for (let row = 0; row < spec.ny; row++) {
    const lat = spec.north - (row + 0.5) * spec.dLat;
    for (let col = 0; col < spec.nx; col++) {
      const cell = row * spec.nx + col;
      if (!wet[cell]) continue;
      const lon = spec.west + (col + 0.5) * spec.dLon;
      let sum = 0;
      for (const rect of rectangles) sum += rectangleUplift(rect, lon, lat);
      uplift[cell] = sum;
    }
  }
  return uplift;
}
