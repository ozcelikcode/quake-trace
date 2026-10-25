import { expose, transfer } from 'comlink';

import { simulate, type SimulationInput } from '@/engine/sim/simulate';
import type { SimulationResult } from '@/types/simulation';

const api = {
  simulate(input: SimulationInput): SimulationResult {
    const result = simulate(input);
    // Hand the large fields over without copying.
    return transfer(result, [
      result.tP.buffer,
      result.tS.buffer,
      result.pgaG.buffer,
      result.pgvCms.buffer,
      result.mmi.buffer,
      result.records.accelCmS2.buffer,
    ]);
  },
};

expose(api);

export type SimulationWorkerApi = typeof api;
