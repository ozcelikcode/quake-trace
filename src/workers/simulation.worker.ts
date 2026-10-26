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
      result.aftershocks.timeS.buffer,
      result.aftershocks.lon.buffer,
      result.aftershocks.lat.buffer,
      result.aftershocks.depthKm.buffer,
      result.aftershocks.magnitude.buffer,
      result.aftershocks.forecastM5.buffer,
      result.aftershocks.forecastM6.buffer,
      ...(result.network
        ? [
            result.network.siteLonLat.buffer,
            result.network.sitePopulation.buffer,
            result.network.siteDensity.buffer,
            result.network.siteSArrivalS.buffer,
            result.network.sitePeakDemand.buffer,
            result.network.siteLossRatio.buffer,
            result.network.cellSite.buffer,
          ]
        : []),
      ...(result.routing
        ? [
            result.routing.impairedEdges.buffer,
            result.routing.impairment.buffer,
            result.routing.impairedAtS.buffer,
            result.routing.corridorEdges.buffer,
            result.routing.corridorUsage.buffer,
            result.routing.corridorFromS.buffer,
          ]
        : []),
    ]);
  },
};

expose(api);

export type SimulationWorkerApi = typeof api;
