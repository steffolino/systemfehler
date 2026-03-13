export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const domain = url.searchParams.get('domain');
  const status = url.searchParams.get('status');
  const search = url.searchParams.get('search');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);
  const includeTranslations = url.searchParams.get('includeTranslations') === 'true' || url.searchParams.get('includeTranslations') === '1';

  try {
    const db = env.DB;

    const clauses = [];
    const filterParams = [];

    if (domain) {
      clauses.push('domain = ?');
      filterParams.push(domain);
    }
    if (status) {
      clauses.push('status = ?');
      filterParams.push(status);
    }
    if (search) {
      clauses.push('(LOWER(title_de) LIKE LOWER(?) OR LOWER(url) LIKE LOWER(?))');
      filterParams.push(`%${search}%`, `%${search}%`);
    }

    const whereClause = clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '';
    const rowsQuery = `SELECT id, domain, url, status, title_de, updated_at, entry_json FROM entries${whereClause} ORDER BY updated_at DESC LIMIT ? OFFSET ?`;
    const countQuery = `SELECT COUNT(*) as count FROM entries${whereClause}`;
    const rowsParams = [...filterParams, limit, offset];
    const countParams = [...filterParams];

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
      // Always set title as string from title_de
      entry.title = row.title_de;
      if (!includeTranslations && entry.translations) {
        delete entry.translations;
      }
      return entry;
    });

    const page = Math.floor(offset / Math.max(limit, 1)) + 1;
    const pages = total > 0 ? Math.ceil(total / Math.max(limit, 1)) : 1;

    return new Response(JSON.stringify({ entries, total, limit, offset, page, pages }), {
      headers: { 'content-type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to read entries', message: err && err.message }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
}
