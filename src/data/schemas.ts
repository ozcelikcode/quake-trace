import { z } from 'zod';

/** Schemas of the prepared JSON and GeoJSON datasets (see memory-bank/dataSources.md). */

const position = z.tuple([z.number(), z.number()]);
const lineString = z.object({
  type: z.literal('LineString'),
  coordinates: z.array(position).min(2),
});
const multiLineString = z.object({
  type: z.literal('MultiLineString'),
  coordinates: z.array(z.array(position).min(2)),
});
const polygon = z.object({ type: z.literal('Polygon'), coordinates: z.array(z.array(position)) });
const multiPolygon = z.object({
  type: z.literal('MultiPolygon'),
  coordinates: z.array(z.array(z.array(position))),
});
const point = z.object({ type: z.literal('Point'), coordinates: position });

function featureCollection<G extends z.ZodType, P extends z.ZodType>(geometry: G, properties: P) {
  return z.object({
    type: z.literal('FeatureCollection'),
    features: z.array(z.object({ type: z.literal('Feature'), geometry, properties })),
  });
}

const range = z.object({ min: z.number(), avg: z.number(), max: z.number() });

export const faultsSchema = featureCollection(
  z.discriminatedUnion('type', [lineString, multiLineString]),
  z.object({
    id: z.string(),
    faultType: z.enum(['normal', 'reverse', 'strike-slip', 'unknown']),
    strikeDeg: range,
    dipDeg: range,
    rakeDeg: range,
    upperDepthKm: z.number(),
    lowerDepthKm: z.number(),
    lengthKm: z.number().positive(),
    widthKm: range,
    slipRateMmYr: z.object({ min: z.number(), mean: z.number(), max: z.number() }),
    mwMax: z.object({ p05: z.number(), avg: z.number(), p95: z.number() }),
  }),
);

export const districtsSchema = featureCollection(
  z.discriminatedUnion('type', [polygon, multiPolygon]),
  z.object({
    index: z.int().nonnegative(),
    id: z.string(),
    name: z.string(),
    province: z.string(),
  }),
);

const periodCounts = z.object({
  before1980: z.number().nonnegative(),
  from1980To2000: z.number().nonnegative(),
  after2000: z.number().nonnegative(),
});
const storeyCounts = z.object({
  low: z.number().nonnegative(),
  mid: z.number().nonnegative(),
  high: z.number().nonnegative(),
});

export const districtStatsSchema = z.object({
  districts: z.array(
    z.object({
      index: z.int().nonnegative(),
      id: z.string(),
      population: z.number().nonnegative(),
      areaKm2: z.number().nonnegative(),
      buildings: z.object({
        total: z.number().nonnegative(),
        byPeriod: periodCounts,
        byStoreys: storeyCounts,
      }),
      buildingSource: z.enum(['ibb-2017', 'estimated']),
    }),
  ),
  estimation: z.object({
    method: z.string(),
    personsPerBuilding: z.number().positive(),
    periodShares: periodCounts,
    storeyShares: storeyCounts,
  }),
});

export const stationsSchema = z.object({
  stations: z.array(
    z.object({
      id: z.string(),
      network: z.string(),
      station: z.string(),
      lat: z.number().min(-90).max(90),
      lon: z.number().min(-180).max(180),
      elevationM: z.number(),
      depthM: z.number(),
      channels: z.array(z.string()).min(1),
      accelerometer: z.boolean(),
      broadband: z.boolean(),
      shortPeriod: z.boolean(),
    }),
  ),
});

export const infraKinds = [
  'hospital',
  'fireStation',
  'police',
  'assemblyPoint',
  'substation',
  'gasPipeline',
] as const;

export const infraSchema = featureCollection(
  z.discriminatedUnion('type', [point, lineString]),
  z.object({
    id: z.string(),
    kind: z.enum(infraKinds),
    name: z.string().optional(),
    beds: z.int().positive().optional(),
  }),
);

export type Faults = z.infer<typeof faultsSchema>;
export type Districts = z.infer<typeof districtsSchema>;
export type District = Districts['features'][number];
export type Fault = Faults['features'][number];
export type DistrictStats = z.infer<typeof districtStatsSchema>;
export type Stations = z.infer<typeof stationsSchema>;
export type Station = Stations['stations'][number];
export type Infra = z.infer<typeof infraSchema>;
