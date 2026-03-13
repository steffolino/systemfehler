export async function onRequest(context) {
  const { params, env } = context;
  const id = params.id;
  try {
    const db = env.DB;
    const row = await db.prepare('SELECT id, domain, url, status, title_de, updated_at, entry_json FROM entries WHERE id = ?').bind(id).first();

    if (!row) {
      return new Response(JSON.stringify({ error: 'Entry not found' }), { status: 404, headers: { 'content-type': 'application/json' } });
    }

    const entry = row.entry_json ? JSON.parse(row.entry_json) : {};
    entry.id = row.id;
    entry.domain = row.domain;
    entry.url = row.url;
    entry.status = row.status;
    entry.title_de = row.title_de;
    entry.updated_at = row.updated_at;
    // Always set title as string from title_de
    entry.title = row.title_de;

    return new Response(JSON.stringify({ entry }), { headers: { 'content-type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to read entry', message: err && err.message }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
}
