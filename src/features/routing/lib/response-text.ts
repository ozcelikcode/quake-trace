import type { TFunction } from 'i18next';

import { formatNumber } from '@/lib/format';
import type { DistrictResponse } from '@/types/routing';

/**
 * "Fire 3.6 min (+0.4)" for a district row, the increase shown from 0.05 min; or the cut-off
 * notice.
 */
export function responseText(t: TFunction, language: string, response: DistrictResponse): string {
  if (!Number.isFinite(response.fireAfterMin)) return t('routing.rowCutOff');
  const value = formatNumber(response.fireAfterMin, language, 1);
  const increase = response.fireAfterMin - response.fireBeforeMin;
  if (increase < 0.05) return t('routing.rowUnchanged', { value });
  return t('routing.row', { value, increase: formatNumber(increase, language, 1) });
}
