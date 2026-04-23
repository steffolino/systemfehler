import { clampPositiveInt, jsonResponse } from '../../_lib/http.js';

function mapRowsWithEntryJson(rows, includeTranslations) {
  return rows.map((row) => {
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
}

function mapRowsLegacy(rows, includeTranslations) {
  return rows.map((row) => {
    const entry = {
      id: row.id,
      domain: row.domain,
      url: row.url,
      status: row.status,
      title_de: row.title_de,
      title_en: row.title_en,
      title_easy_de: row.title_easy_de,
      summary_de: row.summary_de,
      summary_en: row.summary_en,
      summary_easy_de: row.summary_easy_de,
      content_de: row.content_de,
      content_en: row.content_en,
      content_easy_de: row.content_easy_de,
      provenance: row.provenance ? JSON.parse(row.provenance) : null,
      quality_scores: row.quality_scores ? JSON.parse(row.quality_scores) : null,
      translations: row.translations ? JSON.parse(row.translations) : null,
      updated_at: row.updated_at,
    };
    if (!includeTranslations) {
      delete entry.translations;
    }
    return entry;
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const domain = url.searchParams.get('domain');
  const status = url.searchParams.get('status');
  const search = url.searchParams.get('search');
  const limit = clampPositiveInt(url.searchParams.get('limit') || '50', 50, 100);
  const offset = clampPositiveInt(url.searchParams.get('offset') || '0', 0);
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

    let rowsResult;
    let countRow;
    let entries;
    try {
      [rowsResult, countRow] = await Promise.all([
        db.prepare(rowsQuery).bind(...rowsParams).all(),
        db.prepare(countQuery).bind(...countParams).first(),
      ]);
      entries = mapRowsWithEntryJson(rowsResult.results, includeTranslations);
    } catch (error) {
      const message = String(error?.message || '');
      if (!message.includes('no such column: entry_json')) {
        throw error;
      }

      const legacyRowsQuery = `
        SELECT
          id, domain, url, status, updated_at,
          title_de, title_en, title_easy_de,
          summary_de, summary_en, summary_easy_de,
          content_de, content_en, content_easy_de,
          provenance, translations, quality_scores
        FROM entries${whereClause}
        ORDER BY updated_at DESC
        LIMIT ? OFFSET ?`;

      [rowsResult, countRow] = await Promise.all([
        db.prepare(legacyRowsQuery).bind(...rowsParams).all(),
        db.prepare(countQuery).bind(...countParams).first(),
      ]);
      entries = mapRowsLegacy(rowsResult.results, includeTranslations);
    }

    const total = countRow ? countRow.count : 0;

    const page = Math.floor(offset / Math.max(limit, 1)) + 1;
    const pages = total > 0 ? Math.ceil(total / Math.max(limit, 1)) : 1;

    return jsonResponse({ entries, total, limit, offset, page, pages }, { request, env });
  } catch (err) {
    return jsonResponse({ error: 'Failed to read entries', message: err && err.message }, { status: 500, request, env });
  }
}
