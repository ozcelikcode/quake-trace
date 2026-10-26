/**
 * Channel metadata from FDSN StationXML 1.x (level=channel): position, sample rate and the
 * overall instrument sensitivity (counts per input unit at the stated frequency), enough to
 * turn accelerometer counts into acceleration. Parsed with the platform DOMParser.
 */

export interface ChannelSensitivity {
  /** NET.STA.LOC.CHA */
  id: string;
  lon: number;
  lat: number;
  startMs: number;
  /** Open-ended epochs end at Infinity. */
  endMs: number;
  sampleRateHz: number;
  /** Counts per input unit. */
  sensitivity: number;
  inputUnits: string;
}

const NS = 'http://www.fdsn.org/xml/station/1';

function child(element: Element, name: string): Element | undefined {
  return [...element.children].find((node) => node.localName === name);
}

function number(element: Element | undefined): number {
  return element ? Number(element.textContent) : Number.NaN;
}

function epoch(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : fallback;
}

export function channelSensitivities(xml: string): ChannelSensitivity[] {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.getElementsByTagName('parsererror').length > 0) {
    throw new SyntaxError('invalid StationXML');
  }
  const channels: ChannelSensitivity[] = [];
  for (const network of document.getElementsByTagNameNS(NS, 'Network')) {
    for (const station of [...network.children].filter((node) => node.localName === 'Station')) {
      for (const channel of [...station.children].filter((node) => node.localName === 'Channel')) {
        const sensitivityElement = child(
          child(channel, 'Response') ?? channel,
          'InstrumentSensitivity',
        );
        const sensitivity = number(sensitivityElement && child(sensitivityElement, 'Value'));
        const units = sensitivityElement && child(sensitivityElement, 'InputUnits');
        const entry: ChannelSensitivity = {
          id: [
            network.getAttribute('code') ?? '',
            station.getAttribute('code') ?? '',
            channel.getAttribute('locationCode') ?? '',
            channel.getAttribute('code') ?? '',
          ].join('.'),
          lon: number(child(channel, 'Longitude')),
          lat: number(child(channel, 'Latitude')),
          startMs: epoch(channel.getAttribute('startDate'), Number.NEGATIVE_INFINITY),
          endMs: epoch(channel.getAttribute('endDate'), Number.POSITIVE_INFINITY),
          sampleRateHz: number(child(channel, 'SampleRate')),
          sensitivity,
          inputUnits: (units && child(units, 'Name')?.textContent) ?? '',
        };
        if (Number.isFinite(entry.sensitivity) && entry.sensitivity !== 0) channels.push(entry);
      }
    }
  }
  return channels;
}
