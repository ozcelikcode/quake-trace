import { DataError } from './errors';
import { DataRepository, type DataFetcher } from './repository';

const DATA_BASE_URL = `${import.meta.env.BASE_URL}data/`;

/**
 * Production builds carry a gzip copy of every dataset (`compressData` in vite.config.ts):
 * Cloudflare does not compress binary content types, and gzip halves the grids. The copy is
 * fetched as an opaque file and inflated here; the version query makes it safe to cache.
 */
const PRECOMPRESSED = import.meta.env.PROD;

function isGzip(bytes: Uint8Array): boolean {
  return bytes[0] === 0x1f && bytes[1] === 0x8b;
}

async function inflate(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).arrayBuffer();
}

const fetchData: DataFetcher = async (path, version) => {
  // Files stored gzipped in the repository (Vs30 tiles) have no copy; their decoder inflates them.
  const compressed = PRECOMPRESSED && version !== undefined && !path.endsWith('.gz');
  const query = version === undefined ? '' : `?v=${version.slice(0, 16)}`;
  const url = compressed ? `${DATA_BASE_URL}${path}.gz${query}` : `${DATA_BASE_URL}${path}${query}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new DataError(`failed to load ${path}: HTTP ${String(response.status)}`);
  }
  const buffer = await response.arrayBuffer();
  // A host that already decoded the body (Content-Encoding) hands back the raw bytes.
  return compressed && isGzip(new Uint8Array(buffer, 0, 2)) ? inflate(buffer) : buffer;
};

/** The application's single repository instance. */
export const dataRepository = new DataRepository(fetchData);
