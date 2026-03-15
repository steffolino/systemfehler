import { buildRewrite, verifyTurnstile } from '../_lib/ai.js';

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'content-type': 'application/json' },
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
  const query = typeof body?.query === 'string' ? body.query : '';
  const startedAt = Date.now();
  const response = await buildRewrite(env, query);
  response.latency_ms = Date.now() - startedAt;

  return new Response(JSON.stringify(response), {
    headers: { 'content-type': 'application/json' },
  });
}
