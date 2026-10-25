import { readSections, requireSection } from './binary-sections';
import { DataError } from './errors';
import type { DatasetEntry } from './manifest';

type TableEntry = Extract<DatasetEntry, { format: 'binary-table' }>;

/** Cell sites merged from OpenCelliD cells (see pipeline datasets/cells.py). */
export interface CellSites {
  siteCount: number;
  /** Interleaved [lon0, lat0, lon1, lat1, ...]. */
  siteLonLat: Float32Array;
  siteCellCount: Uint16Array;
  siteRangeM: Uint16Array;
  /** Bitmask of radio technologies, see `radioBits`. */
  siteRadios: Uint8Array;
  radioBits: Record<string, number>;
}

export function decodeCellSites(buffer: ArrayBuffer, entry: TableEntry): CellSites {
  const { layout } = entry;
  const views = readSections(buffer, layout.sections);
  const sites: CellSites = {
    siteCount: layout.siteCount,
    siteLonLat: requireSection(views, 'siteLonLat', Float32Array),
    siteCellCount: requireSection(views, 'siteCellCount', Uint16Array),
    siteRangeM: requireSection(views, 'siteRangeM', Uint16Array),
    siteRadios: requireSection(views, 'siteRadios', Uint8Array),
    radioBits: layout.radioBits,
  };
  if (sites.siteLonLat.length !== 2 * sites.siteCount) {
    throw new DataError('cell site sections disagree with the layout');
  }
  return sites;
}
