import { handleProxy } from './proxy';

// The Cache API is a no-op on *.workers.dev hosts; responses still carry Cache-Control
// so browsers avoid repeated requests.
export default {
  async fetch(request, _env, ctx) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) {
      return new Response('Not found', { status: 404 });
    }
    return handleProxy(request, {
      fetch: (upstreamRequest) => fetch(upstreamRequest),
      cache: caches.default,
      waitUntil: (promise) => {
        ctx.waitUntil(promise);
      },
    });
  },
} satisfies ExportedHandler<Env>;
