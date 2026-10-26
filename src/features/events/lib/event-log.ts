import type { Districts } from '@/data/schemas';
import { responseStats } from '@/features/routing';
import {
  CRITICAL_FACILITY_KINDS,
  FACILITY_OUT_OF_SERVICE_FROM,
  type CriticalFacilityKind,
} from '@/types/damage';
import type { RoadGraph } from '@/types/roads';
import { IMPAIRMENTS } from '@/types/routing';
import type { SimulationResult } from '@/types/simulation';
import type { TsunamiResult } from '@/types/tsunami';

/**
 * The simulation's event log: the milestones of a scenario with their time after the origin,
 * derived from the computed result (nothing is recomputed). Entries carry raw values; the panel
 * and the report format them in the active language.
 */

export type LogTone = 'neutral' | 'info' | 'warning' | 'critical';

export type LogEntry = { id: string; timeS: number; tone: LogTone } & (
  | { kind: 'origin'; mw: number; depthKm: number }
  | { kind: 'ruptureEnd'; lengthKm: number }
  | { kind: 'detection'; station: string }
  | { kind: 'alert'; magnitude: number; errorKm: number }
  | { kind: 'sArrival'; district: string; province: string; mmi: number }
  | { kind: 'strongest'; district: string; province: string; mmi: number }
  | { kind: 'facilityOut'; facility: CriticalFacilityKind; count: number }
  | { kind: 'bridgeClosed'; count: number }
  | { kind: 'networkCongested'; count: number }
  | { kind: 'tsunami'; district: string; heightM: number }
  | { kind: 'aftershock'; magnitude: number }
);
export type LogKind = LogEntry['kind'];

/** A province enters the log when shaking there reaches this intensity (MMI V, "strong"). */
const PROVINCE_MIN_MMI = 5;
/** Aftershocks from this magnitude are logged (M 5: damaging near the source). */
const LOGGED_AFTERSHOCK_FROM = 5;

const mmiTone = (mmi: number): LogTone => (mmi >= 8 ? 'critical' : mmi >= 6 ? 'warning' : 'info');

export function eventLog(
  result: SimulationResult,
  tsunami: TsunamiResult | null,
  districts: Districts,
  roads: RoadGraph | undefined,
): LogEntry[] {
  const entries: LogEntry[] = [];
  const name = (index: number) => districts.features[index]?.properties;
  const { rupture } = result;

  entries.push({
    id: 'origin',
    kind: 'origin',
    timeS: 0,
    tone: 'neutral',
    mw: rupture.mw,
    depthKm: rupture.hypocenter.depthKm,
  });
  entries.push({
    id: 'rupture-end',
    kind: 'ruptureEnd',
    timeS: rupture.ruptureDurationS,
    tone: 'neutral',
    lengthKm: rupture.lengthKm,
  });

  const warning = result.earlyWarning;
  if (warning) {
    const first = result.records.stations.reduce<{ id: string; triggerS: number } | null>(
      (best, station) =>
        station.triggerS !== null && (!best || station.triggerS < best.triggerS)
          ? { id: station.id, triggerS: station.triggerS }
          : best,
      null,
    );
    entries.push({
      id: 'detection',
      kind: 'detection',
      timeS: warning.firstTriggerS,
      tone: 'info',
      station: first?.id ?? '',
    });
    entries.push({
      id: 'alert',
      kind: 'alert',
      timeS: warning.alertS,
      tone: 'critical',
      magnitude: warning.magnitude,
      errorKm: warning.locationErrorKm,
    });
  }

  // Districts are sorted by S arrival, so the first one of a province is where the S wave enters.
  const provinces = new Set<string>();
  for (const impact of result.districts) {
    const properties = name(impact.index);
    if (!properties || provinces.has(properties.province)) continue;
    const strongest = result.districts.reduce(
      (max, other) =>
        name(other.index)?.province === properties.province ? Math.max(max, other.maxMmi) : max,
      0,
    );
    provinces.add(properties.province);
    if (strongest < PROVINCE_MIN_MMI) continue;
    entries.push({
      id: `s-${properties.province}`,
      kind: 'sArrival',
      timeS: impact.sArrivalS,
      tone: mmiTone(impact.maxMmi),
      district: properties.name,
      province: properties.province,
      mmi: impact.maxMmi,
    });
  }
  const strongest = result.districts.reduce<(typeof result.districts)[number] | undefined>(
    (max, impact) => (!max || impact.maxMmi > max.maxMmi ? impact : max),
    undefined,
  );
  const strongestName = strongest && name(strongest.index);
  if (strongest && strongestName) {
    entries.push({
      id: 'strongest',
      kind: 'strongest',
      timeS: strongest.sArrivalS,
      tone: mmiTone(strongest.maxMmi),
      district: strongestName.name,
      province: strongestName.province,
      mmi: strongest.maxMmi,
    });
  }

  if (result.damage) {
    for (const facility of CRITICAL_FACILITY_KINDS) {
      const lost = result.damage.facilities.filter(
        (f) => f.kind === facility && f.lossRatio >= FACILITY_OUT_OF_SERVICE_FROM,
      );
      if (lost.length === 0) continue;
      entries.push({
        id: `facility-${facility}`,
        kind: 'facilityOut',
        timeS: Math.min(...lost.map((f) => f.sArrivalS)),
        tone: 'critical',
        facility,
        count: lost.length,
      });
    }
  }

  const { routing } = result;
  if (routing) {
    const bridge = IMPAIRMENTS.indexOf('bridgeClosed');
    const times = Array.from(routing.impairedAtS).filter(
      (_, i) => routing.impairment[i] === bridge,
    );
    if (times.length > 0) {
      entries.push({
        id: 'bridge-closed',
        kind: 'bridgeClosed',
        timeS: Math.min(...times),
        tone: 'warning',
        count: responseStats(routing, new Set(), Number.POSITIVE_INFINITY, roads).bridgesClosed,
      });
    }
  }

  if (result.network) {
    const { network } = result;
    let firstS = Number.POSITIVE_INFINITY;
    let count = 0;
    for (let site = 0; site < network.siteCount; site++) {
      if ((network.sitePeakDemand[site] ?? 1) <= 1) continue;
      count++;
      firstS = Math.min(firstS, network.siteSArrivalS[site] ?? Number.POSITIVE_INFINITY);
    }
    if (count > 0 && Number.isFinite(firstS)) {
      entries.push({
        id: 'network-congested',
        kind: 'networkCongested',
        timeS: firstS,
        tone: 'warning',
        count,
      });
    }
  }

  const firstCoast = tsunami?.coast.reduce<TsunamiResult['coast'][number] | undefined>(
    (min, coast) => (!min || coast.arrivalS < min.arrivalS ? coast : min),
    undefined,
  );
  const firstCoastName = firstCoast && name(firstCoast.index);
  if (firstCoast && firstCoastName && Number.isFinite(firstCoast.arrivalS)) {
    entries.push({
      id: 'tsunami',
      kind: 'tsunami',
      timeS: firstCoast.arrivalS,
      tone: 'warning',
      district: firstCoastName.name,
      heightM: firstCoast.maxEtaM,
    });
  }

  const catalog = result.aftershocks;
  for (let i = 0; i < catalog.count; i++) {
    const magnitude = catalog.magnitude[i] ?? 0;
    if (magnitude < LOGGED_AFTERSHOCK_FROM) continue;
    entries.push({
      id: `aftershock-${String(i)}`,
      kind: 'aftershock',
      timeS: catalog.timeS[i] ?? 0,
      tone: magnitude >= 6 ? 'critical' : 'warning',
      magnitude,
    });
  }

  // Stable: entries at the same time keep the order above (cause before effect).
  return entries.sort((a, b) => a.timeS - b.timeS);
}
