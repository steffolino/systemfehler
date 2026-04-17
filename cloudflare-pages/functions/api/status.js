import { jsonResponse } from './_lib/http.js';

function parseEntry(row) {
  const parsed = row.entry_json ? JSON.parse(row.entry_json) : {};
  parsed.id = row.id;
  parsed.domain = row.domain;
  parsed.url = row.url;
  parsed.status = row.status;
  parsed.title_de = row.title_de;
  parsed.updated_at = row.updated_at;
  return parsed;
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

export async function onRequest(context) {
  const { env } = context;

  try {
    const db = env.DB;
    if (!db) {
      return jsonResponse(
        {
          database: {
            totalEntries: 0,
            byDomain: {}
          },
          moderation: {
            pending: 0
          },
          qualityScores: {
            avgIqs: '0.00',
            avgAis: '0.00'
          },
          timestamp: new Date().toISOString()
        },
        { request: context.request, env }
      );
    }

    const [entryRowsResult, moderationPendingRow] = await Promise.all([
      db.prepare('SELECT id, domain, url, status, title_de, updated_at, entry_json FROM entries').all(),
      db.prepare("SELECT COUNT(*) as count FROM moderation_queue WHERE status = 'pending'").first()
    ]);

    const entryRows = entryRowsResult.results || [];
    const entries = entryRows.map(parseEntry);

    const byDomain = {};
    for (const entry of entries) {
      const domain = entry.domain || 'unknown';
      const status = entry.status || 'unknown';
      if (!byDomain[domain]) {
        byDomain[domain] = {};
      }
      byDomain[domain][status] = (byDomain[domain][status] || 0) + 1;
    }

    const totalEntries = entries.length;
    const avgIqs =
      totalEntries > 0
        ? (
            entries.reduce((sum, entry) => sum + toNumber(entry.iqs ?? entry.qualityScores?.iqs), 0) /
            totalEntries
          ).toFixed(2)
        : '0.00';
    const avgAis =
      totalEntries > 0
        ? (
            entries.reduce((sum, entry) => sum + toNumber(entry.ais ?? entry.qualityScores?.ais), 0) /
            totalEntries
          ).toFixed(2)
        : '0.00';

    return jsonResponse(
      {
        database: {
          totalEntries,
          byDomain
        },
        moderation: {
          pending: Number(moderationPendingRow?.count || 0)
        },
        qualityScores: {
          avgIqs,
          avgAis
        },
        timestamp: new Date().toISOString()
      },
      { request: context.request, env }
    );
  } catch (err) {
    return jsonResponse({ error: 'Failed to fetch status', message: err && err.message }, {
      status: 500,
      request: context.request,
      env
    });
  }
}
