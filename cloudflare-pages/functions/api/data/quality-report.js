import { jsonResponse } from '../_lib/http.js';

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

function hasTranslation(entry, language) {
  const map = entry.translations;
  return Boolean(map && typeof map === 'object' && map[language]);
}

export async function onRequest(context) {
  const { env, request } = context;

  try {
    const db = env.DB;
    if (!db) {
      return jsonResponse({ byDomain: {}, lowQualityEntries: [], missingTranslations: [] }, { request, env });
    }

    const rowsResult = await db
      .prepare('SELECT id, domain, url, status, title_de, updated_at, entry_json FROM entries')
      .all();

    const entries = (rowsResult.results || []).map(parseEntry);
    const domainBuckets = {};

    for (const entry of entries) {
      const domain = entry.domain || 'unknown';
      if (!domainBuckets[domain]) {
        domainBuckets[domain] = [];
      }
      domainBuckets[domain].push(entry);
    }

    const byDomain = {};
    for (const [domain, list] of Object.entries(domainBuckets)) {
      const totalEntries = list.length;
      const activeEntries = list.filter((entry) => entry.status === 'active').length;
      const avgIqs =
        totalEntries > 0
          ? (list.reduce((sum, entry) => sum + toNumber(entry.iqs ?? entry.qualityScores?.iqs), 0) / totalEntries).toFixed(2)
          : '0.00';
      const avgAis =
        totalEntries > 0
          ? (list.reduce((sum, entry) => sum + toNumber(entry.ais ?? entry.qualityScores?.ais), 0) / totalEntries).toFixed(2)
          : '0.00';
      const missingEnTranslation = list.filter((entry) => !entry.title?.en && !entry.title_en && !hasTranslation(entry, 'en')).length;
      const missingEasyDeTranslation = list.filter((entry) => !entry.title?.easy_de && !entry.title_easy_de && !hasTranslation(entry, 'de-LEICHT')).length;

      byDomain[domain] = {
        totalEntries,
        activeEntries,
        avgIqs,
        avgAis,
        missingEnTranslation,
        missingEasyDeTranslation
      };
    }

    const lowQualityEntries = entries
      .filter((entry) => toNumber(entry.iqs ?? entry.qualityScores?.iqs) < 50 || toNumber(entry.ais ?? entry.qualityScores?.ais) < 50)
      .map((entry) => ({
        id: entry.id,
        domain: entry.domain,
        title: entry.title?.de || entry.title_de || 'Untitled',
        url: entry.url,
        iqs: toNumber(entry.iqs ?? entry.qualityScores?.iqs),
        ais: toNumber(entry.ais ?? entry.qualityScores?.ais)
      }));

    const missingTranslations = entries
      .map((entry) => {
        const missingEn = !entry.title?.en && !entry.title_en && !hasTranslation(entry, 'en');
        const missingEasyDe = !entry.title?.easy_de && !entry.title_easy_de && !hasTranslation(entry, 'de-LEICHT');
        return {
          id: entry.id,
          domain: entry.domain,
          title: entry.title?.de || entry.title_de || 'Untitled',
          url: entry.url,
          missingEn,
          missingEasyDe
        };
      })
      .filter((entry) => entry.missingEn || entry.missingEasyDe);

    return jsonResponse({ byDomain, lowQualityEntries, missingTranslations }, { request, env });
  } catch (err) {
    return jsonResponse({ error: 'Failed to fetch quality report', message: err && err.message }, { status: 500, request, env });
  }
}
