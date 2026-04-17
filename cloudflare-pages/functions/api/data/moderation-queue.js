import { clampPositiveInt, jsonResponse } from '../_lib/http.js';

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
  const limit = clampPositiveInt(url.searchParams.get('limit') || '100', 100, 100);
  const offset = clampPositiveInt(url.searchParams.get('offset') || '0', 0);

  try {
    const db = env.DB;
    if (!db) {
      return jsonResponse({ queue: [], total: 0, status, domain: domain || undefined }, { request, env });
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

    const queue = (rowsResult.results || []).map((row) => {
      const candidateData = parseJsonSafely(row.candidate_data);
      const existingData = parseJsonSafely(row.existing_data);
      const diff = parseJsonSafely(row.diff);
      const provenance = parseJsonSafely(row.provenance);

      return {
        id: row.id,
        entryId: row.entry_id,
        entry_id: row.entry_id,
        domain: row.domain,
        status: row.status,
        action: row.action,
        title: row.title_de ? { de: row.title_de } : undefined,
        title_de: row.title_de,
        url: row.url,
        candidateData,
        candidate_data: candidateData,
        existingData,
        existing_data: existingData,
        diff,
        provenance,
        reviewedBy: row.reviewed_by,
        reviewed_by: row.reviewed_by,
        reviewedAt: row.reviewed_at,
        reviewed_at: row.reviewed_at,
        createdAt: row.created_at,
        created_at: row.created_at,
        updatedAt: row.updated_at,
        updated_at: row.updated_at
      };
    });

    const total = Number(countRow?.count || 0);

    return jsonResponse({ queue, total, status, domain: domain || undefined }, { request, env });
  } catch (err) {
    return jsonResponse(
      { error: 'Failed to read moderation queue', message: err && err.message },
      { status: 500, request, env }
    );
  }
}
