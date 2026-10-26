import type { Districts } from '@/data/schemas';
import type { SimulationResult } from '@/types/simulation';
import type { TsunamiResult } from '@/types/tsunami';

/**
 * Per-district results of a scenario for export, in machine-readable form: English snake_case
 * columns, SI-style units in the column names, dots as decimal separators, empty cells where a
 * value does not exist (no tsunami at an inland district, a district cut off by road).
 */

export const DISTRICT_COLUMNS = [
  'district_id',
  'name',
  'province',
  'p_arrival_s',
  's_arrival_s',
  'mmi',
  'warning_s',
  'loss_ratio',
  'buildings_lost',
  'fatalities',
  'stock_estimated',
  'fire_before_min',
  'fire_after_min',
  'hospital_after_min',
  'tsunami_arrival_s',
  'tsunami_max_m',
] as const;
export type DistrictColumn = (typeof DISTRICT_COLUMNS)[number];
export type DistrictRow = Record<DistrictColumn, string | number | boolean | null>;

const finite = (value: number | undefined, digits: number): number | null =>
  value === undefined || !Number.isFinite(value) ? null : Number(value.toFixed(digits));

/** One row per district reached by the S wave, in order of arrival. */
export function districtRows(
  result: SimulationResult,
  tsunami: TsunamiResult | null,
  districts: Districts,
): DistrictRow[] {
  const damage = new Map(result.damage?.districts.map((d) => [d.index, d]));
  const response = new Map(result.routing?.districts.map((r) => [r.index, r]));
  const coast = new Map(tsunami?.coast.map((c) => [c.index, c]));
  const alertS = result.earlyWarning?.alertS;
  return result.districts.flatMap((impact) => {
    const properties = districts.features[impact.index]?.properties;
    if (!properties) return [];
    const loss = damage.get(impact.index);
    const routes = response.get(impact.index);
    const sea = coast.get(impact.index);
    return [
      {
        district_id: properties.id,
        name: properties.name,
        province: properties.province,
        p_arrival_s: finite(impact.pArrivalS, 1),
        s_arrival_s: finite(impact.sArrivalS, 1),
        mmi: finite(impact.maxMmi, 1),
        // Negative: the S wave arrived before the alert (blind zone).
        warning_s: alertS === undefined ? null : finite(impact.sArrivalS - alertS, 1),
        loss_ratio: finite(loss?.lossRatio, 4),
        buildings_lost: finite(loss?.buildingsLost, 0),
        fatalities: finite(loss?.fatalities, 0),
        stock_estimated: loss ? loss.estimated : null,
        fire_before_min: finite(routes?.fireBeforeMin, 1),
        fire_after_min: finite(routes?.fireAfterMin, 1),
        hospital_after_min: finite(routes?.hospitalAfterMin, 1),
        tsunami_arrival_s: finite(sea?.arrivalS, 0),
        tsunami_max_m: finite(sea?.maxEtaM, 2),
      },
    ];
  });
}

/** RFC 4180 field: quoted when it holds a comma, quote or line break. */
function csvField(value: string | number | boolean | null): string {
  if (value === null) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** CSV with CRLF line ends (RFC 4180) and a byte-order mark, so spreadsheets read UTF-8. */
export function toCsv(rows: readonly DistrictRow[]): string {
  const lines = [
    DISTRICT_COLUMNS.join(','),
    ...rows.map((row) => DISTRICT_COLUMNS.map((column) => csvField(row[column])).join(',')),
  ];
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

export interface ExportMeta {
  scenarioId: string;
  /** Share link that reproduces the scenario. */
  url: string;
  generatedAt: string;
  disclaimer: string;
}

/**
 * GeoJSON (RFC 7946) of the district results with their outlines, plus the ruptured fault trace
 * and the epicentre. Foreign members at the top level mark the file as simulated output.
 */
export function toGeoJson(
  result: SimulationResult,
  rows: readonly DistrictRow[],
  districts: Districts,
  meta: ExportMeta,
): GeoJSON.FeatureCollection & Record<string, unknown> {
  const byId = new Map(districts.features.map((feature) => [feature.properties.id, feature]));
  const { rupture } = result;
  return {
    type: 'FeatureCollection',
    simulation: true,
    generator: 'quakeTrace',
    scenario: meta.scenarioId,
    url: meta.url,
    generatedAt: meta.generatedAt,
    disclaimer: meta.disclaimer,
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [rupture.hypocenter.lon, rupture.hypocenter.lat],
        },
        properties: {
          layer: 'epicentre',
          mw: Number(rupture.mw.toFixed(2)),
          depth_km: Number(rupture.hypocenter.depthKm.toFixed(1)),
        },
      },
      {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: rupture.trace.map(([lon, lat]) => [lon, lat]),
        },
        properties: {
          layer: 'rupture',
          length_km: Number(rupture.lengthKm.toFixed(1)),
          width_km: Number(rupture.widthKm.toFixed(1)),
        },
      },
      ...rows.flatMap((row) => {
        const feature = typeof row.district_id === 'string' ? byId.get(row.district_id) : undefined;
        return feature
          ? [
              {
                type: 'Feature' as const,
                geometry: feature.geometry,
                properties: { layer: 'district', ...row },
              },
            ]
          : [];
      }),
    ],
  };
}
