export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    // CORS Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // /api/data/entries/:id
    const entryIdMatch = url.pathname.match(/^\/api\/data\/entries\/([a-f0-9\-]+)$/);
    if (entryIdMatch) {
      const id = entryIdMatch[1];
      try {
        const db = env.DB;
        const row = await db.prepare('SELECT id, domain, url, status, title_de, updated_at, entry_json FROM entries WHERE id = ?').bind(id).first();
        if (!row) {
          return new Response(JSON.stringify({ error: 'Entry not found' }), { status: 404, headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }});
        }
        const entry = row.entry_json ? JSON.parse(row.entry_json) : {};
        entry.id = row.id;
        entry.domain = row.domain;
        entry.url = row.url;
        entry.status = row.status;
        entry.title_de = row.title_de;
        entry.updated_at = row.updated_at;
        return new Response(JSON.stringify({ entry }), { headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }});
      } catch (err) {
        return new Response(JSON.stringify({ error: 'Failed to read entry', message: err && err.message }), { status: 500, headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }});
      }
    }
// Cloudflare Worker entry point for Systemfehler API

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    // CORS Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
        },
      });
    }
    // Simple routing for /api/health and /api/version
    if (url.pathname === '/api/health') {
      return new Response(JSON.stringify({ ok: true }), {
          headers: {
           'Content-Type': 'application/json',
           'Access-Control-Allow-Origin': '*',
          }
      });
    }
    if (url.pathname === '/api/version') {
      return new Response(JSON.stringify({
        service: 'systemfehler-api-worker',
        version: '0.1.0',
        runtime: 'cloudflare-worker',
        timestamp: new Date().toISOString()
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      });
    }

    if (url.pathname === '/api/data/entries') {
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
          if (!includeTranslations && entry.translations) {
            delete entry.translations;
          }
          return entry;
        });
        const page = Math.floor(offset / Math.max(limit, 1)) + 1;
        const pages = total > 0 ? Math.ceil(total / Math.max(limit, 1)) : 1;
        return new Response(JSON.stringify({ entries, total, limit, offset, page, pages }), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: 'Failed to read entries', message: err && err.message }), { status: 500, headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }});
      }
    }
    return new Response('Not found', { status: 404, headers: {
      'Access-Control-Allow-Origin': '*',
    }});
  }
};
