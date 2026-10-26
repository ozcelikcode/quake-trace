import { expose, transfer } from 'comlink';

import { simulateTsunami, type TsunamiInput } from '@/engine/tsunami/tsunami';
import type { TsunamiResult } from '@/types/tsunami';

const api = {
  simulate(input: TsunamiInput): TsunamiResult {
    const result = simulateTsunami(input);
    // Hand the frames and per-cell fields over without copying.
    return transfer(result, [
      result.wetCells.buffer,
      result.framesMm.buffer,
      result.maxEtaM.buffer,
      result.arrivalS.buffer,
    ]);
  },
};

expose(api);

export type TsunamiWorkerApi = typeof api;
