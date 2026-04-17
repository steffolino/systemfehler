import {
  buildSynthesis,
  cacheJsonResponse,
  enforceRateLimit,
  getCachedJsonResponse,
  getCacheTtl,
  normalizeQuery,
  retrieveEvidence,
  verifyTurnstile,
} from '../_lib/ai.js';
import { applySecurityHeaders, jsonResponse, optionsResponse, readJsonBody } from '../_lib/http.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') {
    return optionsResponse(request, env, { methods: 'POST, OPTIONS', headers: 'Content-Type, x-turnstile-token' });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405, request, env, cors: true });
  }

  const rateLimit = await enforceRateLimit(request, env, 'synthesize');
  if (!rateLimit.allowed) {
    return jsonResponse({ error: 'Too many AI requests. Please wait a moment.' }, {
      status: 429,
      request,
      env,
      cors: true,
      headers: {
        ...rateLimit.headers,
      },
    });
  }

  const turnstile = await verifyTurnstile(request, env);
  if (!turnstile.success) {
    return jsonResponse(
      { error: turnstile.error || 'Turnstile verification failed.' },
      { status: 403, request, env, cors: true }
    );
  }

  const bodyResult = await readJsonBody(request, {
    maxBytes: Number.parseInt(String(env.AI_MAX_BODY_BYTES || '100000'), 10) || 100000,
  });
  if (!bodyResult.ok) {
    return jsonResponse({ error: bodyResult.error }, { status: bodyResult.status, request, env, cors: true });
  }
  const body = bodyResult.body;
  const query = normalizeQuery(typeof body?.query === 'string' ? body.query : '');
  const startedAt = Date.now();
  const evidence = await retrieveEvidence(env, query);
  const evidenceKey = evidence
    .filter((item) => item.confidence >= 0.7)
    .slice(0, 3)
    .map((item) => item.source)
    .join('|');
  const { cache, cacheKey, cached } = await getCachedJsonResponse(request, [
    'synthesize',
    env.CF_AI_MODEL || '',
    query,
    evidenceKey,
  ]);
  if (cached) {
    return jsonResponse(JSON.parse(await cached.text()), {
      request,
      env,
      cors: true,
      headers: {
        ...rateLimit.headers,
        'X-Cache': 'HIT',
      },
    });
  }
  const response = await buildSynthesis(env, query, evidence);
  response.latency_ms = Date.now() - startedAt;
  const cachedResponse = await cacheJsonResponse(cache, cacheKey, response, getCacheTtl(env, 'synthesize'));
  cachedResponse.headers.set('X-Cache', 'MISS');
  for (const [key, value] of Object.entries(rateLimit.headers)) {
    cachedResponse.headers.set(key, value);
  }
  return applySecurityHeaders(
    cachedResponse,
    request,
    env,
    { methods: 'POST, OPTIONS', headers: 'Content-Type, x-turnstile-token' }
  );
}
