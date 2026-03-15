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
      host: url.host,
      port: 443,
    }),
    { headers: { 'content-type': 'application/json' } }
  );
}
