import { bearingDeg, haversineKm } from '@/lib/math/geo';
import { cellIndex } from '@/lib/math/grid';
import type { GridSpec } from '@/types/grid';
import type { StationRecord, StationRecords, StationSite } from '@/types/simulation';

import { firstTriggerIndex, LTA_S, STA_S, staLtaRatio } from '../eew/sta-lta';
import { asb14LnMedian } from '../gmpe/asb14';
import { G_CMS2 } from '../intensity/worden2012';
import { createRandom, deriveSeed } from '../random/random';
import type { Rupture } from '../rupture/finite-fault';
import { excitationDurationS } from '../synth/point-source';
import { synthesizeStation, type StationSynthesisInput } from '../synth/station-record';
import { WINDOW_DURATION_FACTOR } from '../synth/window';
import type { RuptureArrivals } from './arrivals';
import type { PolygonDistance } from './polygon-distance';

/** Strong-motion sampling rate (the HN channels of the KO network record at 100 Hz). */
export const RECORD_SAMPLE_RATE_HZ = 100;
/** Noise synthesized before the origin, so the LTA window is already full at t = 0. */
const PRE_EVENT_S = LTA_S;
/** P velocity of a Poisson solid relative to Vs30, for the near-surface incidence angle. */
const NEAR_SURFACE_VP_OVER_VS = Math.sqrt(3);

export interface StationContext {
  rupture: Rupture;
  arrivals: RuptureArrivals;
  surface: PolygonDistance;
  grid: GridSpec;
  vs30: Float32Array;
  rakeDeg: number;
}

export interface StationPlan {
  record: StationRecord;
  synthesis: StationSynthesisInput;
  /** End of the station's S-wave window, s after origin. */
  endS: number;
}

/**
 * Arrivals, distances, site and target PGA for each station. Stations outside the grid or
 * without a Vs30 value are skipped.
 */
export function planStations(
  sites: readonly StationSite[],
  context: StationContext,
): StationPlan[] {
  const { rupture, arrivals, surface, grid, vs30, rakeDeg } = context;
  const { hypocenter, mw } = rupture;
  const plans: StationPlan[] = [];
  for (const site of sites) {
    const cell = cellIndex(grid, site.lon, site.lat);
    const siteVs30 = cell < 0 ? Number.NaN : (vs30[cell] ?? Number.NaN);
    if (!Number.isFinite(siteVs30)) continue;

    arrivals.locate(site.lon, site.lat);
    const rjbKm = surface.distanceKm(site.lon, site.lat);
    const distanceKm = arrivals.ruptureDistanceKm();
    const pgaCmS2 = Math.exp(asb14LnMedian('PGA', { mw, rjbKm, vs30: siteVs30, rakeDeg })) * G_CMS2;
    // Snell's law: sin i = p·Vp at the surface, with Vp from Vs30 (Vs30 in m/s, p in s/km).
    const pIncidenceSine = arrivals.pSlownessSKm() * NEAR_SURFACE_VP_OVER_VS * (siteVs30 / 1000);

    plans.push({
      record: {
        id: site.id,
        lon: site.lon,
        lat: site.lat,
        epicentralKm: haversineKm(hypocenter.lon, hypocenter.lat, site.lon, site.lat),
        rjbKm,
        vs30: siteVs30,
        pArrivalS: arrivals.pArrivalS,
        sArrivalS: arrivals.sArrivalS,
        pgaCmS2,
        triggerS: null,
      },
      synthesis: {
        mw,
        distanceKm,
        pArrivalS: arrivals.pArrivalS,
        sArrivalS: arrivals.sArrivalS,
        azimuthDeg: bearingDeg(hypocenter.lon, hypocenter.lat, site.lon, site.lat),
        pIncidenceSine,
        targetPgaCmS2: pgaCmS2,
      },
      endS: arrivals.sArrivalS + WINDOW_DURATION_FACTOR * excitationDurationS(mw, distanceKm, 'S'),
    });
  }
  return plans;
}

/**
 * Synthesizes every planned station from the origin to `durationS` and records the first
 * STA/LTA trigger on its vertical component. Each station draws from its own seeded stream.
 */
export function synthesizeRecords(
  plans: readonly StationPlan[],
  seed: number,
  durationS: number,
): StationRecords {
  const rate = RECORD_SAMPLE_RATE_HZ;
  const samples = Math.floor(durationS * rate) + 1;
  const preSamples = PRE_EVENT_S * rate;
  const timing = { startS: -PRE_EVENT_S, sampleRateHz: rate, samples: preSamples + samples };
  const components = {
    z: new Float64Array(timing.samples),
    n: new Float64Array(timing.samples),
    e: new Float64Array(timing.samples),
  };
  const accelCmS2 = new Float32Array(plans.length * 3 * samples);

  plans.forEach((plan, station) => {
    const random = createRandom(deriveSeed(seed, plan.record.id));
    synthesizeStation(random, plan.synthesis, timing, components);
    const trigger = firstTriggerIndex(staLtaRatio(components.z, STA_S * rate, LTA_S * rate));
    plan.record.triggerS = trigger < 0 ? null : trigger / rate - PRE_EVENT_S;
    [components.z, components.n, components.e].forEach((component, c) => {
      accelCmS2.set(component.subarray(preSamples), (station * 3 + c) * samples);
    });
  });

  return {
    sampleRateHz: rate,
    samples,
    accelCmS2,
    stations: plans.map((plan) => plan.record),
  };
}
