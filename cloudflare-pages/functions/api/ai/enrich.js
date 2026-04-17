import { jsonResponse, optionsResponse, readJsonBody } from '../_lib/http.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') {
    return optionsResponse(request, env, { methods: 'POST, OPTIONS', headers: 'Content-Type, x-turnstile-token' });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405, request, env, cors: true });
  }

  const bodyResult = await readJsonBody(request, {
    maxBytes: Number.parseInt(String(env.AI_MAX_BODY_BYTES || '100000'), 10) || 100000,
  });
  if (!bodyResult.ok) {
    return jsonResponse({ error: bodyResult.error }, { status: bodyResult.status, request, env, cors: true });
  }
  const body = bodyResult.body;
  const entryId = typeof body?.entry_id === 'string' ? body.entry_id : '';

  return jsonResponse(
    {
      entry_id: entryId,
      summary: ['Metadata enrichment is currently optimized for the local AI sidecar.'],
      quality_flags: [],
      metadata: {
        topics: { current: [], suggested: [], added: [], removed: [], confidence: 0, rationale: '' },
        tags: { current: [], suggested: [], added: [], removed: [], confidence: 0, rationale: '' },
        target_groups: { current: [], suggested: [], added: [], removed: [], confidence: 0, rationale: '' },
        keywords: { current: [], suggested: [], added: [], removed: [], confidence: 0, rationale: '' },
      },
      provenance: {
        provider: env.AI ? 'workers-ai' : 'none',
        model: env.CF_AI_MODEL || '@cf/meta/llama-3.1-8b-instruct',
        fallback: true,
      },
    },
    { request, env, cors: true }
  );
}
