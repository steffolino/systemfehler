import { jsonResponse } from '../../_lib/http.js';

export async function onRequest(context) {
  const { params, env, request } = context;
  const id = params.id;
  try {
    const db = env.DB;
    const row = await db.prepare('SELECT id, domain, url, status, title_de, updated_at, entry_json FROM entries WHERE id = ?').bind(id).first();

    if (!row) {
      return jsonResponse({ error: 'Entry not found' }, { status: 404, request, env });
    }

    const entry = row.entry_json ? JSON.parse(row.entry_json) : {};
    entry.id = row.id;
    entry.domain = row.domain;
    entry.url = row.url;
    entry.status = row.status;
    entry.title_de = row.title_de;
    entry.updated_at = row.updated_at;

    return jsonResponse({ entry }, { request, env });
  } catch (err) {
    return jsonResponse({ error: 'Failed to read entry', message: err && err.message }, { status: 500, request, env });
  }
}
