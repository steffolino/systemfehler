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
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'content-type': 'application/json' } });
  }

  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token || !env.INGEST_TOKEN || !timingSafeEqual(token, env.INGEST_TOKEN)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }

  const { domain, entries } = body;
  if (!domain || typeof domain !== 'string') {
    return new Response(JSON.stringify({ error: 'Missing or invalid domain' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }
  if (!Array.isArray(entries)) {
    return new Response(JSON.stringify({ error: 'entries must be an array' }), { status: 400, headers: { 'content-type': 'application/json' } });
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

    return new Response(JSON.stringify({ ok: true, upserted: batch.length, skipped }), { headers: { 'content-type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to ingest entries', message: err && err.message }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
}
