import { expose, transfer } from 'comlink';

import { dataRepository } from '@/data/browser';
import { planEventGrid, simulate, type SimulationInput } from '@/engine/sim/simulate';
import type { SimulationResult } from '@/types/simulation';

const api = {
  /**
   * Plans the event grid, fetches the worldwide Vs30 tiles it covers (cached by the browser),
   * then simulates.
   */
  async simulate(input: SimulationInput): Promise<SimulationResult> {
    const eventGrid = planEventGrid(input.scenario, input.maxEventCells);
    const siteGrids = await dataRepository.vs30Tiles({
      west: eventGrid.west,
      east: eventGrid.west + eventGrid.nx * eventGrid.dLon,
      south: eventGrid.north - eventGrid.ny * eventGrid.dLat,
      north: eventGrid.north,
    });
    const result = simulate({ ...input, eventGrid, siteGrids });
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
