import { z } from 'zod';

/** Schema of public/data/manifest.json, written by pipeline/src/quaketrace_pipeline/manifest.py. */

const sourceSchema = z.object({
  name: z.string(),
  url: z.url(),
  license: z.string(),
  attribution: z.string(),
});

export const gridSpecSchema = z.object({
  west: z.number(),
  north: z.number(),
  dLon: z.number().positive(),
  dLat: z.number().positive(),
  nx: z.int().positive(),
  ny: z.int().positive(),
  rowOrder: z.literal('north-to-south'),
  encoding: z.literal('float32-le'),
});

export const sectionSchema = z.object({
  name: z.string(),
  type: z.enum(['float32', 'uint32', 'uint16', 'uint8']),
  byteOffset: z.int().nonnegative(),
  length: z.int().nonnegative(),
});

const entryFields = {
  path: z.string().min(1),
  bytes: z.int().positive(),
  sha256: z.string().length(64),
  generatedAt: z.iso.datetime(),
  sources: z.array(sourceSchema).min(1),
  units: z.string().optional(),
  notes: z.string().optional(),
  stats: z.record(z.string(), z.unknown()).optional(),
};

export const datasetEntrySchema = z.discriminatedUnion('format', [
  z.object({ ...entryFields, format: z.literal('geojson') }),
  z.object({ ...entryFields, format: z.literal('json') }),
  z.object({ ...entryFields, format: z.literal('float32-grid'), grid: z.string() }),
  z.object({
    ...entryFields,
    format: z.literal('csr-graph'),
    layout: z.object({
      nodeCount: z.int().nonnegative(),
      edgeCount: z.int().nonnegative(),
      sections: z.array(sectionSchema),
      classes: z.array(z.string()),
      flags: z.record(z.string(), z.int()),
    }),
  }),
  z.object({
    ...entryFields,
    format: z.literal('binary-table'),
    layout: z.object({
      siteCount: z.int().nonnegative(),
      sections: z.array(sectionSchema),
      radioBits: z.record(z.string(), z.int()),
    }),
  }),
]);

export const manifestSchema = z.object({
  version: z.literal(1),
  grids: z.record(z.string(), gridSpecSchema),
  datasets: z.record(z.string(), datasetEntrySchema),
});

export type Manifest = z.infer<typeof manifestSchema>;
export type GridSpec = z.infer<typeof gridSpecSchema>;
export type Section = z.infer<typeof sectionSchema>;
export type DatasetEntry = z.infer<typeof datasetEntrySchema>;
export type DataSource = DatasetEntry['sources'][number];
