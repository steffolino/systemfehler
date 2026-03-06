function parseJsonSafely(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const status = url.searchParams.get('status') || 'pending';
  const domain = url.searchParams.get('domain');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 100);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);

  try {
    const db = env.DB;
    if (!db) {
      return new Response(JSON.stringify({ queue: [], total: 0, status, domain: domain || undefined }), {
        headers: { 'content-type': 'application/json' }
      });
    }

    let rowsQuery;
    let countQuery;
    let rowsParams;
    let countParams;

    if (domain) {
      rowsQuery = 'SELECT id, entry_id, domain, status, action, title_de, url, candidate_data, existing_data, diff, provenance, reviewed_by, reviewed_at, created_at, updated_at FROM moderation_queue WHERE status = ? AND domain = ? ORDER BY created_at DESC LIMIT ? OFFSET ?';
      countQuery = 'SELECT COUNT(*) as count FROM moderation_queue WHERE status = ? AND domain = ?';
      rowsParams = [status, domain, limit, offset];
      countParams = [status, domain];
    } else {
      rowsQuery = 'SELECT id, entry_id, domain, status, action, title_de, url, candidate_data, existing_data, diff, provenance, reviewed_by, reviewed_at, created_at, updated_at FROM moderation_queue WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?';
      countQuery = 'SELECT COUNT(*) as count FROM moderation_queue WHERE status = ?';
      rowsParams = [status, limit, offset];
      countParams = [status];
    }

    const [rowsResult, countRow] = await Promise.all([
      db.prepare(rowsQuery).bind(...rowsParams).all(),
      db.prepare(countQuery).bind(...countParams).first()
    ]);

    const queue = (rowsResult.results || []).map((row) => ({
      id: row.id,
      entry_id: row.entry_id,
      domain: row.domain,
      status: row.status,
      action: row.action,
      title_de: row.title_de,
      url: row.url,
      candidate_data: parseJsonSafely(row.candidate_data),
      existing_data: parseJsonSafely(row.existing_data),
      diff: parseJsonSafely(row.diff),
      provenance: parseJsonSafely(row.provenance),
      reviewed_by: row.reviewed_by,
      reviewed_at: row.reviewed_at,
      created_at: row.created_at,
      updated_at: row.updated_at
    }));

    const total = Number(countRow?.count || 0);

    return new Response(JSON.stringify({ queue, total, status, domain: domain || undefined }), {
      headers: { 'content-type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to read moderation queue', message: err && err.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
}
