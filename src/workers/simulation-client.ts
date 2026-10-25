import { wrap, type Remote } from 'comlink';

import type { SimulationWorkerApi } from './simulation.worker';

let remote: Remote<SimulationWorkerApi> | undefined;

/** The simulation worker, started on first use and kept for later scenarios. */
export function simulationWorker(): Remote<SimulationWorkerApi> {
  remote ??= wrap<SimulationWorkerApi>(
    new Worker(new URL('./simulation.worker.ts', import.meta.url), { type: 'module' }),
  );
  return remote;
}
