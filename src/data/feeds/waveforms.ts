import { readMiniSeed, type MiniSeedTrace } from '@/lib/formats/miniseed';
import { channelSensitivities, type ChannelSensitivity } from '@/lib/formats/station-xml';
import type { RecordComponent } from '@/types/simulation';

import type { Fetcher } from './client';

/**
 * Observed strong-motion records from the KOERI EIDA node (through the proxy, `/api/koeri`):
 * miniSEED from `dataselect` and instrument sensitivities from `station` (level=channel).
 * Counts become cm/s² by removing the pre-event mean and dividing by the sensitivity (m/s² per
 * count), the flat-response approximation that holds for accelerometers well below their corner.
 */

export interface ObservedRecord {
  /** NET.STA, as in stations.json. */
  stationId: string;
  /** Acceleration from the origin on, cm/s², one array per component. */
  components: Partial<Record<RecordComponent, Float32Array>>;
}

/** Seconds of data before the origin used for the pre-event mean. */
export const PRE_EVENT_S = 10;
const M_TO_CM = 100;
const COMPONENT_OF: Record<string, RecordComponent> = {
  Z: 'Z',
  N: 'N',
  '1': 'N',
  E: 'E',
  '2': 'E',
};

export interface ObservedRequest {
  /** Station ids NET.STA. */
  stationIds: readonly string[];
  originMs: number;
  durationS: number;
  /** The records are kept at this rate (others are skipped). */
  sampleRateHz: number;
}

function isoSeconds(ms: number): string {
  return new Date(ms).toISOString().slice(0, 19);
}

export function observedUrls(request: ObservedRequest): { dataselect: string; station: string } {
  const networks = [...new Set(request.stationIds.map((id) => id.split('.')[0] ?? ''))];
  const stations = request.stationIds.map((id) => id.split('.')[1] ?? '');
  const start = isoSeconds(request.originMs - PRE_EVENT_S * 1000);
  const end = isoSeconds(request.originMs + request.durationS * 1000);
  const selection = `net=${networks.join(',')}&sta=${stations.join(',')}&cha=HN?`;
  return {
    dataselect: `/api/koeri/dataselect/1/query?${selection}&start=${start}&end=${end}`,
    station: `/api/koeri/station/1/query?${selection}&level=channel&starttime=${start}&endtime=${end}`,
  };
}

/** Acceleration (cm/s²) aligned to the origin from one decoded channel, or null if unusable. */
export function toAcceleration(
  trace: MiniSeedTrace,
  sensitivity: ChannelSensitivity,
  request: ObservedRequest,
): Float32Array | null {
  if (trace.sampleRateHz !== request.sampleRateHz || !/^m\/s\*\*2$/i.test(sensitivity.inputUnits)) {
    return null;
  }
  const rate = request.sampleRateHz;
  const offset = Math.round(((request.originMs - trace.startMs) / 1000) * rate);
  const preEvent = trace.samples.subarray(0, Math.max(0, Math.min(trace.samples.length, offset)));
  if (preEvent.length === 0) return null;
  const mean = preEvent.reduce((sum, value) => sum + value, 0) / preEvent.length;
  const length = Math.floor(request.durationS * rate) + 1;
  const out = new Float32Array(length);
  const scale = M_TO_CM / sensitivity.sensitivity;
  for (let i = 0; i < length; i++) {
    const source = offset + i;
    out[i] =
      source >= 0 && source < trace.samples.length
        ? ((trace.samples[source] ?? mean) - mean) * scale
        : 0;
  }
  return out;
}

/** Fetches and converts the records; stations without data are absent from the result. */
export async function fetchObservedRecords(
  request: ObservedRequest,
  fetcher: Fetcher = (url) => fetch(url),
): Promise<ObservedRecord[]> {
  const urls = observedUrls(request);
  const [waveforms, metadata] = await Promise.all([
    fetcher(urls.dataselect),
    fetcher(urls.station),
  ]);
  // FDSN answers 204 when no data matches.
  if (waveforms.status === 204 || metadata.status === 204) return [];
  if (!waveforms.ok || !metadata.ok) {
    throw new Error(`HTTP ${String(waveforms.ok ? metadata.status : waveforms.status)}`);
  }
  const traces = readMiniSeed(await waveforms.arrayBuffer());
  const sensitivities = channelSensitivities(await metadata.text());

  const byStation = new Map<string, ObservedRecord>();
  for (const trace of traces) {
    const id = `${trace.network}.${trace.station}.${trace.location}.${trace.channel}`;
    const sensitivity = sensitivities.find(
      (c) => c.id === id && c.startMs <= trace.startMs && trace.startMs < c.endMs,
    );
    const component = COMPONENT_OF[trace.channel.slice(-1)];
    if (!sensitivity || !component) continue;
    const acceleration = toAcceleration(trace, sensitivity, request);
    if (!acceleration) continue;
    const stationId = `${trace.network}.${trace.station}`;
    const record = byStation.get(stationId) ?? { stationId, components: {} };
    record.components[component] = acceleration;
    byStation.set(stationId, record);
  }
  return [...byStation.values()];
}
