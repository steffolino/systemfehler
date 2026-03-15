import { retrieveEvidence, verifyTurnstile } from '../_lib/ai.js';

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
  const evidence = await retrieveEvidence(env, query);

  return new Response(
    JSON.stringify({
      evidence,
      weak_evidence: !evidence.some((item) => item.confidence >= 0.7),
      latency_ms: Date.now() - startedAt,
    }),
    { headers: { 'content-type': 'application/json' } }
  );
}
