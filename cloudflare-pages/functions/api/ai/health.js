import { getWorkersAiModel } from '../_lib/ai.js';

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  return new Response(
    JSON.stringify({
      status: 'ok',
      provider: {
        provider: env.AI ? 'workers-ai' : 'none',
        configured: Boolean(env.AI),
        status: env.AI ? 'ok' : 'disabled',
        models: env.AI ? [getWorkersAiModel(env)] : [],
      },
      turnstile: {
        configured: Boolean(env.TURNSTILE_SECRET_KEY),
      },
      caching: {
        retrieveTtlSeconds: Number(env.AI_CACHE_TTL_RETRIEVE_SECONDS || 180),
        rewriteTtlSeconds: Number(env.AI_CACHE_TTL_REWRITE_SECONDS || 3600),
        synthesizeTtlSeconds: Number(env.AI_CACHE_TTL_SYNTHESIZE_SECONDS || 900),
      },
      rateLimit: {
        windowSeconds: Number(env.AI_RATE_LIMIT_WINDOW_SECONDS || 60),
        maxRequests: Number(env.AI_RATE_LIMIT_MAX_REQUESTS || 12),
      },
      host: url.host,
      port: 443,
    }),
    {
      headers: {
        'content-type': 'application/json',
        'Cache-Control': 'public, max-age=60',
      },
    }
  );
}
