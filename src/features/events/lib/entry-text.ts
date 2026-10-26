import type { TFunction } from 'i18next';

import { mmiRoman } from '@/lib/color/mmi';
import { formatNumber } from '@/lib/format';

import type { LogEntry } from './event-log';

/** The log line of an entry in the active language. */
export function entryText(t: TFunction, language: string, entry: LogEntry): string {
  const number = (value: number, digits = 0) => formatNumber(value, language, digits);
  switch (entry.kind) {
    case 'origin':
      return t('events.log.origin', { mw: number(entry.mw, 1), depth: number(entry.depthKm) });
    case 'ruptureEnd':
      return t('events.log.ruptureEnd', { length: number(entry.lengthKm) });
    case 'detection':
      return t('events.log.detection', { station: entry.station });
    case 'alert':
      return t('events.log.alert', {
        magnitude: number(entry.magnitude, 1),
        error: number(entry.errorKm, 1),
      });
    case 'sArrival':
      return t('events.log.sArrival', {
        province: entry.province,
        district: entry.district,
        mmi: mmiRoman(entry.mmi),
      });
    case 'strongest':
      return t('events.log.strongest', {
        province: entry.province,
        district: entry.district,
        mmi: mmiRoman(entry.mmi),
      });
    case 'facilityOut':
      return t(`events.log.facilityOut.${entry.facility}`, { count: entry.count });
    case 'bridgeClosed':
      return t('events.log.bridgeClosed', { count: entry.count });
    case 'networkCongested':
      return t('events.log.networkCongested', {
        count: entry.count,
        formatted: number(entry.count),
      });
    case 'tsunami':
      return t('events.log.tsunami', {
        district: entry.district,
        height: number(entry.heightM, 1),
      });
    case 'aftershock':
      return t('events.log.aftershock', { magnitude: number(entry.magnitude, 1) });
  }
}
