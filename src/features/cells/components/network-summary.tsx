import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/cn';
import { formatNumber, formatPercent } from '@/lib/format';
import { usePlaybackStore } from '@/state/playback-store';
import type { NetworkResult, SiteState } from '@/types/network';

import { summarizeNetwork } from '../lib/site-state';

const SHOWN: readonly Exclude<SiteState, 'pending'>[] = ['normal', 'congested', 'down'];
const DOT: Record<Exclude<SiteState, 'pending'>, string> = {
  normal: 'bg-ok',
  congested: 'bg-warning',
  down: 'bg-critical',
};
/** Summary refreshes per half second of simulation time; demand changes over minutes. */
const STEP_S = 0.5;

/** Cell sites reached by the S wave, by state, with the people affected and blocked calls. */
export function NetworkSummary({ network }: { network: NetworkResult }) {
  const { t, i18n } = useTranslation();
  const timeS = usePlaybackStore((state) => Math.floor(state.timeS / STEP_S) * STEP_S);
  const summary = summarizeNetwork(network, timeS);
  const reached = network.siteCount - summary.sites.pending;
  const number = (value: number, digits = 0) => formatNumber(value, i18n.language, digits);

  return (
    <section aria-labelledby="network-title" data-testid="network-summary" className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h3 id="network-title" className="label-micro">
          {t('network.title')}
        </h3>
        <span className="num text-micro text-fg-muted">
          {t('network.reached', { count: reached, total: network.siteCount })}
        </span>
      </div>
      <ul className="grid grid-cols-3 gap-px overflow-hidden rounded-panel border border-line bg-line">
        {SHOWN.map((state) => (
          <li key={state} className="bg-surface-1 px-3 py-2">
            <span className="flex items-center gap-1.5 text-micro text-fg-muted">
              <span aria-hidden className={cn('size-2 rounded-full', DOT[state])} />
              {t(`network.state.${state}`)}
            </span>
            <span className="num text-body text-fg">{number(summary.sites[state])}</span>
          </li>
        ))}
      </ul>
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-line bg-line">
        <div className="bg-surface-1 px-3 py-2">
          <dt className="text-micro text-fg-muted">{t('network.residentsCongested')}</dt>
          <dd className="num text-body text-fg">
            {number(summary.residents.congested + summary.residents.down)}
          </dd>
        </div>
        <div className="bg-surface-1 px-3 py-2">
          <dt className="text-micro text-fg-muted">{t('network.blocked')}</dt>
          <dd className="num text-body text-fg">
            {reached > 0 ? formatPercent(summary.blockedShare, i18n.language) : '—'}
          </dd>
        </div>
      </dl>
      <p className="text-micro text-fg-muted">
        {network.synthetic ? `${t('network.syntheticSites')} ` : ''}
        {t('network.note')}
      </p>
    </section>
  );
}
