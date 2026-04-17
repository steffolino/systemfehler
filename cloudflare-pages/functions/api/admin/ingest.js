import { jsonResponse, readJsonBody } from '../_lib/http.js';

function timingSafeEqual(a, b) {
  const enc = new TextEncoder();
  const aBytes = enc.encode(a);
  const bBytes = enc.encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let mismatch = 0;
  for (let i = 0; i < aBytes.length; i++) {
    mismatch |= aBytes[i] ^ bBytes[i];
  }
  return mismatch === 0;
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405, request, env });
  }

  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token || !env.INGEST_TOKEN || !timingSafeEqual(token, env.INGEST_TOKEN)) {
    return jsonResponse({ error: 'Unauthorized' }, { status: 401, request, env });
  }

  const bodyResult = await readJsonBody(request, {
    maxBytes: Number.parseInt(String(env.INGEST_MAX_BODY_BYTES || '8000000'), 10) || 8000000,
  });
  if (!bodyResult.ok) {
    return jsonResponse({ error: bodyResult.error }, { status: bodyResult.status, request, env });
  }
  const body = bodyResult.body;

  const { domain, entries } = body;
  const validDomains = new Set(['benefits', 'aid', 'tools', 'organizations', 'contacts']);
  if (!domain || typeof domain !== 'string' || !validDomains.has(domain)) {
    return jsonResponse({ error: 'Missing or invalid domain' }, { status: 400, request, env });
  }
  if (!Array.isArray(entries)) {
    return jsonResponse({ error: 'entries must be an array' }, { status: 400, request, env });
  }

  const maxEntries = Number.parseInt(String(env.INGEST_MAX_ENTRIES || '1500'), 10) || 1500;
  if (entries.length > maxEntries) {
    return jsonResponse(
      { error: `Too many entries. Maximum allowed per request is ${maxEntries}.` },
      { status: 413, request, env }
    );
  }

  try {
    const db = env.DB;
    const now = new Date().toISOString();
    const stmt = db.prepare(
      'INSERT INTO entries (id, domain, url, status, title_de, updated_at, entry_json) VALUES (?, ?, ?, ?, ?, ?, ?) ' +
      'ON CONFLICT(id) DO UPDATE SET domain=excluded.domain, url=excluded.url, status=excluded.status, ' +
      'title_de=excluded.title_de, updated_at=excluded.updated_at, entry_json=excluded.entry_json'
    );

    const validEntries = entries.filter(e => e && e.id);
    const skipped = entries.length - validEntries.length;
    const batch = validEntries.map(entry =>
      stmt.bind(
        entry.id,
        domain,
        entry.url || null,
        entry.status || null,
        entry.title_de || null,
        entry.updated_at || now,
        JSON.stringify(entry)
      )
    );

    if (batch.length > 0) {
      await db.batch(batch);
    }

    return jsonResponse({ ok: true, upserted: batch.length, skipped }, { request, env });
  } catch (err) {
    return jsonResponse({ error: 'Failed to ingest entries', message: err && err.message }, { status: 500, request, env });
  }
}
