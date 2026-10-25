import { describe, expect, it, vi } from 'vitest';

import { handleProxy, resolveTarget, type ResponseCache } from '../../../worker/proxy';

const origin = 'https://quaketrace.example';

function request(path: string, init?: RequestInit): Request {
  return new Request(`${origin}${path}`, init);
}

function memoryCache(): ResponseCache & { store: Map<string, Response> } {
  const store = new Map<string, Response>();
  return {
    store,
    match: (key) => Promise.resolve(store.get(key.url)?.clone()),
    put: (key, response) => {
      store.set(key.url, response);
      return Promise.resolve();
    },
  };
}

describe('resolveTarget', () => {
  it('maps AFAD events to the API gateway with a browser user agent', () => {
    const target = resolveTarget(new URL(`${origin}/api/afad/event/filter?minmag=3`));
    expect(target?.url.toString()).toBe(
      'https://servisnet.afad.gov.tr/apigateway/deprem/apiv2/event/filter?minmag=3',
    );
    expect(target?.headers['User-Agent']).toMatch(/Mozilla/);
    expect(target?.cacheSeconds).toBe(30);
  });

  it('maps KOERI FDSN paths with per-path cache lifetimes', () => {
    const station = resolveTarget(new URL(`${origin}/api/koeri/station/1/query?network=KO`));
    const waveform = resolveTarget(new URL(`${origin}/api/koeri/dataselect/1/query?net=KO`));
    expect(station?.url.toString()).toBe(
      'http://eida-service.koeri.boun.edu.tr/fdsnws/station/1/query?network=KO',
    );
    expect(station?.cacheSeconds).toBe(86_400);
    expect(waveform?.cacheSeconds).toBe(30);
  });

  it.each([
    '/api/unknown/x',
    '/api/afad/',
    '/api/afad/event/other',
    '/api/kandilli/../admin',
    '/api/constructor/x',
    '/other',
  ])('rejects %s', (path) => {
    expect(resolveTarget(new URL(`${origin}${path}`))).toBeUndefined();
  });
});

describe('handleProxy', () => {
  it('forwards allowed GET requests and sets Cache-Control', async () => {
    const fetchUpstream = vi.fn((upstream: Request) => {
      expect(upstream.url).toBe('http://www.koeri.boun.edu.tr/scripts/lst0.asp');
      return Promise.resolve(
        new Response('<pre>list</pre>', {
          headers: { 'Content-Type': 'text/html', 'Set-Cookie': 'session=1' },
        }),
      );
    });

    const response = await handleProxy(request('/api/kandilli/lst0.asp'), { fetch: fetchUpstream });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('<pre>list</pre>');
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=30');
    expect(response.headers.get('Content-Type')).toBe('text/html');
    expect(response.headers.get('Set-Cookie')).toBeNull();
  });

  it('rejects non-GET methods and unknown routes', async () => {
    const fetchUpstream = vi.fn();
    const post = await handleProxy(request('/api/kandilli/lst0.asp', { method: 'POST' }), {
      fetch: fetchUpstream,
    });
    const unknown = await handleProxy(request('/api/nowhere/x'), { fetch: fetchUpstream });

    expect(post.status).toBe(405);
    expect(unknown.status).toBe(404);
    expect(fetchUpstream).not.toHaveBeenCalled();
  });

  it('serves repeated requests from the cache', async () => {
    const cache = memoryCache();
    const fetchUpstream = vi.fn(() => Promise.resolve(new Response('[]')));

    await handleProxy(request('/api/afad/event/filter?a=1'), { fetch: fetchUpstream, cache });
    const second = await handleProxy(request('/api/afad/event/filter?a=1'), {
      fetch: fetchUpstream,
      cache,
    });

    expect(fetchUpstream).toHaveBeenCalledTimes(1);
    expect(await second.text()).toBe('[]');
  });

  it('passes through empty FDSN results without caching them', async () => {
    const cache = memoryCache();
    const fetchUpstream = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));

    const response = await handleProxy(request('/api/koeri/dataselect/1/query?net=KO'), {
      fetch: fetchUpstream,
      cache,
    });

    expect(response.status).toBe(204);
    expect(cache.store.size).toBe(0);
  });

  it('maps upstream failures to gateway errors', async () => {
    const serverError = await handleProxy(request('/api/kandilli/lst0.asp'), {
      fetch: () => Promise.resolve(new Response('down', { status: 503 })),
    });
    const unreachable = await handleProxy(request('/api/kandilli/lst0.asp'), {
      fetch: () => Promise.reject(new TypeError('network')),
    });
    const timeout = await handleProxy(request('/api/kandilli/lst0.asp'), {
      fetch: () => Promise.reject(new DOMException('timed out', 'TimeoutError')),
    });

    expect(serverError.status).toBe(502);
    expect(unreachable.status).toBe(502);
    expect(timeout.status).toBe(504);
  });
});
