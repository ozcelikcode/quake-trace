import { upstreams, type Upstream } from './upstreams';

/** Subset of the Workers Cache API the proxy needs; injectable for tests. */
export interface ResponseCache {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}

export interface ProxyDependencies {
  fetch: (request: Request) => Promise<Response>;
  cache?: ResponseCache;
  waitUntil?: (promise: Promise<unknown>) => void;
  timeoutMs?: number;
}

export interface ResolvedTarget {
  url: URL;
  cacheSeconds: number;
  headers: Readonly<Record<string, string>>;
}

const API_PREFIX = '/api/';
const DEFAULT_TIMEOUT_MS = 15_000;

function isUpstreamId(id: string): id is keyof typeof upstreams {
  return Object.hasOwn(upstreams, id);
}

/** Maps `/api/<id>/<path>?<query>` to the upstream URL, or `undefined` if not allowed. */
export function resolveTarget(requestUrl: URL): ResolvedTarget | undefined {
  if (!requestUrl.pathname.startsWith(API_PREFIX)) return undefined;

  const rest = requestUrl.pathname.slice(API_PREFIX.length);
  const slash = rest.indexOf('/');
  if (slash <= 0) return undefined;

  const id = rest.slice(0, slash);
  const path = rest.slice(slash);
  if (!isUpstreamId(id)) return undefined;

  const upstream: Upstream = upstreams[id];
  const cacheSeconds = upstream.paths[path];
  if (cacheSeconds === undefined) return undefined;

  const url = new URL(`${upstream.basePath}${path}`, upstream.origin);
  url.search = requestUrl.search;
  return { url, cacheSeconds, headers: upstream.headers ?? {} };
}

function jsonError(status: number, error: string): Response {
  return Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function handleProxy(request: Request, deps: ProxyDependencies): Promise<Response> {
  if (request.method !== 'GET') return jsonError(405, 'method_not_allowed');

  const target = resolveTarget(new URL(request.url));
  if (!target) return jsonError(404, 'unknown_route');

  const cacheKey = new Request(target.url.toString(), { method: 'GET' });
  const cached = await deps.cache?.match(cacheKey);
  if (cached) return cached;

  let upstreamResponse: Response;
  try {
    upstreamResponse = await deps.fetch(
      new Request(target.url.toString(), {
        method: 'GET',
        headers: target.headers,
        signal: AbortSignal.timeout(deps.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      }),
    );
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === 'TimeoutError';
    return jsonError(timedOut ? 504 : 502, timedOut ? 'upstream_timeout' : 'upstream_unreachable');
  }

  if (upstreamResponse.status >= 500) return jsonError(502, 'upstream_error');

  const headers = new Headers({ 'Cache-Control': `public, max-age=${target.cacheSeconds}` });
  const contentType = upstreamResponse.headers.get('Content-Type');
  if (contentType) headers.set('Content-Type', contentType);

  const response = new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers,
  });

  if (response.status === 200 && deps.cache) {
    const stored = deps.cache.put(cacheKey, response.clone());
    if (deps.waitUntil) deps.waitUntil(stored);
    else await stored;
  }
  return response;
}
