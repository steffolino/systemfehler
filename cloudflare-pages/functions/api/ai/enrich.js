export async function onRequest({ request, env }) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'content-type': 'application/json' },
    });
  }

  const body = await request.json().catch(() => ({}));
  const entryId = typeof body?.entry_id === 'string' ? body.entry_id : '';

  return new Response(
    JSON.stringify({
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
    }),
    { headers: { 'content-type': 'application/json' } }
  );
}
