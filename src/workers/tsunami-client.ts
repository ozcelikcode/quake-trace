import { wrap, type Remote } from 'comlink';

import type { TsunamiWorkerApi } from './tsunami.worker';

let remote: Remote<TsunamiWorkerApi> | undefined;

/**
 * The tsunami worker, separate from the simulation worker so an hour of wave propagation never
 * delays the next scenario's shaking; started on first use.
 */
export function tsunamiWorker(): Remote<TsunamiWorkerApi> {
  remote ??= wrap<TsunamiWorkerApi>(
    new Worker(new URL('./tsunami.worker.ts', import.meta.url), { type: 'module' }),
  );
  return remote;
}
