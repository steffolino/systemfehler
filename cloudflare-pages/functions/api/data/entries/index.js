export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const domain = url.searchParams.get('domain');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);
  const includeTranslations = url.searchParams.get('includeTranslations') === 'true' || url.searchParams.get('includeTranslations') === '1';

  try {
    const db = env.DB;

    let rowsQuery, countQuery, rowsParams, countParams;
    if (domain) {
      rowsQuery = 'SELECT id, domain, url, status, title_de, updated_at, entry_json FROM entries WHERE domain = ? ORDER BY updated_at DESC LIMIT ? OFFSET ?';
      rowsParams = [domain, limit, offset];
      countQuery = 'SELECT COUNT(*) as count FROM entries WHERE domain = ?';
      countParams = [domain];
    } else {
      rowsQuery = 'SELECT id, domain, url, status, title_de, updated_at, entry_json FROM entries ORDER BY updated_at DESC LIMIT ? OFFSET ?';
      rowsParams = [limit, offset];
      countQuery = 'SELECT COUNT(*) as count FROM entries';
      countParams = [];
    }

    const [rowsResult, countRow] = await Promise.all([
      db.prepare(rowsQuery).bind(...rowsParams).all(),
      db.prepare(countQuery).bind(...countParams).first()
    ]);

    const total = countRow ? countRow.count : 0;

    const entries = rowsResult.results.map(row => {
      const entry = row.entry_json ? JSON.parse(row.entry_json) : {};
      entry.id = row.id;
      entry.domain = row.domain;
      entry.url = row.url;
      entry.status = row.status;
      entry.title_de = row.title_de;
      entry.updated_at = row.updated_at;
      if (!includeTranslations && entry.translations) {
        delete entry.translations;
      }
      return entry;
    });

    const page = Math.floor(offset / limit) + 1;

    return new Response(JSON.stringify({ entries, total, limit, offset, page, pages: Math.ceil(total / limit) }), {
      headers: { 'content-type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to read entries', message: err && err.message }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
}
