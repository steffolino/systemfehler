import {
  buildRewrite,
  cacheJsonResponse,
  enforceRateLimit,
  getCachedJsonResponse,
  getCacheTtl,
  normalizeQuery,
  verifyTurnstile,
} from '../_lib/ai.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': request.headers.get('Origin') || '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, x-turnstile-token',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'content-type': 'application/json' },
    });
  }

  const rateLimit = await enforceRateLimit(request, env, 'rewrite');
  if (!rateLimit.allowed) {
    return new Response(JSON.stringify({ error: 'Too many AI requests. Please wait a moment.' }), {
      status: 429,
      headers: {
        'content-type': 'application/json',
        ...rateLimit.headers,
      },
    });
  }

  const turnstile = await verifyTurnstile(request, env);
  if (!turnstile.success) {
    return new Response(JSON.stringify({ error: turnstile.error || 'Turnstile verification failed.' }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    });
  }

  const body = await request.json().catch(() => ({}));
  const query = normalizeQuery(typeof body?.query === 'string' ? body.query : '');
  const startedAt = Date.now();
  const { cache, cacheKey, cached } = await getCachedJsonResponse(request, ['rewrite', env.CF_AI_MODEL || '', query]);
  if (cached) {
    return new Response(await cached.text(), {
      headers: {
        'content-type': 'application/json',
        ...rateLimit.headers,
        'X-Cache': 'HIT',
      },
    });
  }
  const response = await buildRewrite(env, query);
  response.latency_ms = Date.now() - startedAt;
  const cachedResponse = await cacheJsonResponse(cache, cacheKey, response, getCacheTtl(env, 'rewrite'));
  cachedResponse.headers.set('X-Cache', 'MISS');
  for (const [key, value] of Object.entries(rateLimit.headers)) {
    cachedResponse.headers.set(key, value);
  }
  return cachedResponse;
}
