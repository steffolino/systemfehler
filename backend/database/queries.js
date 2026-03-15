/**
 * Database Query Layer
 *
 * Encapsulates all SQL queries for the application.
 */

import fs from 'fs/promises';
import path from 'path';
import { query } from './connection.js';

function buildMultilingual({ de, en, easyDe }) {
  const result = {};

  if (de) result.de = de;
  if (en) result.en = en;
  if (easyDe) result.easy_de = easyDe;

  return Object.keys(result).length > 0 ? result : undefined;
}

function withLegacyKeys(entry, legacyMap) {
  Object.entries(legacyMap).forEach(([legacyKey, sourceKey]) => {
    if (Object.prototype.hasOwnProperty.call(entry, sourceKey)) {
      entry[legacyKey] = entry[sourceKey];
    }
  });

  return entry;
}

function summarizeDiff(diff) {
  if (!diff || typeof diff !== 'object') {
    return {
      type: 'update',
      addedCount: 0,
      modifiedCount: 0,
      removedCount: 0,
      unchangedCount: 0,
      totalChanges: 0
    };
  }

  const added = diff.added && typeof diff.added === 'object' ? diff.added : {};
  const modified = diff.modified && typeof diff.modified === 'object' ? diff.modified : {};
  const removed = diff.removed && typeof diff.removed === 'object' ? diff.removed : {};
  const unchanged = diff.unchanged && typeof diff.unchanged === 'object' ? diff.unchanged : {};

  return {
    type: diff.type || 'update',
    addedCount: Object.keys(added).length,
    modifiedCount: Object.keys(modified).length,
    removedCount: Object.keys(removed).length,
    unchangedCount: Object.keys(unchanged).length,
    totalChanges:
      Object.keys(added).length +
      Object.keys(modified).length +
      Object.keys(removed).length
  };
}

function mapEntryRow(row, options = {}) {
  const { includeTranslations = false } = options;

  const title = row.title_de; // Use only the string from title_de

  const summary = buildMultilingual({
    de: row.summary_de,
    en: row.summary_en,
    easyDe: row.summary_easy_de
  });

  const content = buildMultilingual({
    de: row.content_de,
    en: row.content_en,
    easyDe: row.content_easy_de
  });

  const translations = includeTranslations ? (row.translations || null) : null;

  const base = {
    id: row.id,
    domain: row.domain,
    title,
    summary,
    content,
    url: row.url,
    topics: row.topics || [],
    tags: row.tags || [],
    targetGroups: row.target_groups || [],
    status: row.status,
    validFrom: row.valid_from || undefined,
    validUntil: row.valid_until || undefined,
    deadline: row.deadline || undefined,
    firstSeen: row.first_seen || undefined,
    lastSeen: row.last_seen || undefined,
    sourceUnavailable: row.source_unavailable,
    provenance: row.provenance || null,
    qualityScores: row.quality_scores || null,
    iqs: row.iqs !== null && row.iqs !== undefined ? Number(row.iqs) : null,
    ais: row.ais !== null && row.ais !== undefined ? Number(row.ais) : null,
    createdAt: row.created_at || undefined,
    updatedAt: row.updated_at || undefined,
    translations,
    translationLanguages: translations ? Object.keys(translations) : []
  };

  const withBackCompat = withLegacyKeys(base, {
    target_groups: 'targetGroups',
    valid_from: 'validFrom',
    valid_until: 'validUntil',
    first_seen: 'firstSeen',
    last_seen: 'lastSeen',
    source_unavailable: 'sourceUnavailable',
    quality_scores: 'qualityScores',
    created_at: 'createdAt',
    updated_at: 'updatedAt'
  });

  return {
    ...withBackCompat,
    title_de: row.title_de || null,
    title_en: row.title_en || null,
    title_easy_de: row.title_easy_de || null,
    summary_de: row.summary_de || null,
    summary_en: row.summary_en || null,
    summary_easy_de: row.summary_easy_de || null,
    content_de: row.content_de || null,
    content_en: row.content_en || null,
    content_easy_de: row.content_easy_de || null
  };
}

function mapDomainRow(domain, row) {
  if (!row) {
    return null;
  }

  if (domain === 'benefits') {
    const benefitAmount = buildMultilingual({
      de: row.benefit_amount_de,
      en: row.benefit_amount_en,
      easyDe: row.benefit_amount_easy_de
    });

    const eligibility = buildMultilingual({
      de: row.eligibility_criteria_de,
      en: row.eligibility_criteria_en,
      easyDe: row.eligibility_criteria_easy_de
    });

    return {
      benefitAmount: benefitAmount || undefined,
      benefit_amount_de: row.benefit_amount_de || null,
      benefit_amount_en: row.benefit_amount_en || null,
      benefit_amount_easy_de: row.benefit_amount_easy_de || null,
      eligibilityCriteria: eligibility || undefined,
      eligibility_criteria_de: row.eligibility_criteria_de || null,
      eligibility_criteria_en: row.eligibility_criteria_en || null,
      eligibility_criteria_easy_de: row.eligibility_criteria_easy_de || null,
      duration: row.duration || undefined,
      applicationSteps: row.application_steps || [],
      requiredDocuments: row.required_documents || [],
      formLink: row.form_link || undefined,
      contactInfo: row.contact_info || null
    };
  }

  return row;
}

function attachTranslations(entries, translationsMap) {
  entries.forEach((entry) => {
    if (translationsMap[entry.id]) {
      entry.translations = translationsMap[entry.id];
      entry.translationLanguages = Object.keys(translationsMap[entry.id]);
    } else {
      entry.translations = null;
      entry.translationLanguages = [];
    }
  });
}

function getLanguageColumns(language = 'german') {
  const isEnglish = language === 'english';

  return {
    titleCol: isEnglish ? 'title_en' : 'title_de',
    summaryCol: isEnglish ? 'summary_en' : 'summary_de',
    contentCol: isEnglish ? 'content_en' : 'content_de'
  };
}

function buildPagination(total, limit, offset) {
  return {
    total,
    limit,
    offset,
    page: Math.floor(offset / limit) + 1,
    pages: Math.ceil(total / limit)
  };
}

async function loadTranslationsForDomains(domainNames = []) {
  const translationsMap = {};

  for (const domainName of domainNames) {
    try {
      const filePath = path.resolve(process.cwd(), 'data', domainName, 'entries.json');
      const txt = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(txt || '{}');
      const entries = Array.isArray(parsed) ? parsed : parsed.entries || [];

      if (Array.isArray(entries)) {
        entries.forEach((entry) => {
          if (entry && entry.id && entry.translations) {
            translationsMap[entry.id] = entry.translations;
          }
        });
      }
    } catch {
      // Ignore missing domains or parse errors.
    }
  }

  return translationsMap;
}

async function loadTranslationsForEntries(entries) {
  const domainNames = [...new Set(entries.map((entry) => entry.domain).filter(Boolean))];
  const translationsMap = await loadTranslationsForDomains(domainNames);
  attachTranslations(entries, translationsMap);
}

async function loadTranslationsForSingleEntry(entry) {
  if (!entry?.domain || !entry?.id) {
    return entry;
  }

  try {
    const filePath = path.resolve(process.cwd(), 'data', entry.domain, 'entries.json');
    const txt = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(txt || '{}');
    const entries = Array.isArray(parsed) ? parsed : parsed.entries || [];

    if (Array.isArray(entries)) {
      const matched = entries.find((item) => item && item.id === entry.id);

      if (matched?.translations) {
        entry.translations = matched.translations;
        entry.translationLanguages = Object.keys(matched.translations);
      }
    }
  } catch {
    // Ignore missing file or parse errors.
  }

  return entry;
}

/**
 * Dedicated substring search for autocomplete.
 * Matches as soon as input is a substring of the title.
 */
export async function searchEntriesForAutocomplete(options = {}) {
  const {
    searchText,
    domain = null,
    limit = 10,
    offset = 0
  } = options;

  const term = (searchText || '').trim();

  if (!term) {
    return { entries: [], total: 0, limit, offset };
  }

  const whereConditions = [
    `(
      COALESCE(e.title_de, '') ILIKE $1 OR
      COALESCE(e.title_en, '') ILIKE $1 OR
      COALESCE(e.title_easy_de, '') ILIKE $1
    )`
  ];

  const params = [`%${term}%`];
  let paramIndex = 2;

  if (domain) {
    whereConditions.push(`e.domain = $${paramIndex++}`);
    params.push(domain);
  }

  const whereClause = whereConditions.join(' AND ');

  const sql = `
    SELECT
      e.*,
      (e.quality_scores->>'iqs')::numeric AS iqs,
      (e.quality_scores->>'ais')::numeric AS ais
    FROM entries e
    WHERE ${whereClause}
    ORDER BY e.created_at DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}
  `;

  params.push(limit, offset);

  const result = await query(sql, params);

  return {
    entries: result.rows.map((row) => mapEntryRow(row)),
    total: result.rows.length,
    limit,
    offset
  };
}

/**
 * Get all entries with optional filtering.
 */
export async function getAllEntries(options = {}) {
  const {
    domain = null,
    status = null,
    includeTranslations = false,
    limit = 50,
    offset = 0
  } = options;

  const whereConditions = [];
  const params = [];
  let paramIndex = 1;

  if (domain) {
    whereConditions.push(`domain = $${paramIndex++}`);
    params.push(domain);
  }

  if (status) {
    whereConditions.push(`status = $${paramIndex++}`);
    params.push(status);
  }

  const whereClause =
    whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

  const countQuery = `SELECT COUNT(*)::int AS total FROM entries ${whereClause}`;
  const countResult = await query(countQuery, params);
  const total = countResult.rows[0]?.total || 0;

  const entriesQuery = `
    SELECT
      e.*,
      (e.quality_scores->>'iqs')::numeric AS iqs,
      (e.quality_scores->>'ais')::numeric AS ais
    FROM entries e
    ${whereClause}
    ORDER BY e.created_at DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}
  `;

  const entriesParams = [...params, limit, offset];
  const entriesResult = await query(entriesQuery, entriesParams);

  const entries = entriesResult.rows.map((row) =>
    mapEntryRow(row, { includeTranslations })
  );

  if (includeTranslations) {
    await loadTranslationsForEntries(entries);
  }

  return {
    entries,
    ...buildPagination(total, limit, offset)
  };
}

/**
 * Get entry by ID with domain-specific data.
 */
export async function getEntryById(id) {
  const entryQuery = `
    SELECT
      e.*,
      (e.quality_scores->>'iqs')::numeric AS iqs,
      (e.quality_scores->>'ais')::numeric AS ais
    FROM entries e
    WHERE e.id = $1
  `;

  const result = await query(entryQuery, [id]);

  if (result.rows.length === 0) {
    return null;
  }

  const entryRow = result.rows[0];
  const entry = mapEntryRow(entryRow, { includeTranslations: true });

  if (entry.domain) {
    const domainQuery = `SELECT * FROM ${entry.domain} WHERE entry_id = $1`;
    const domainResult = await query(domainQuery, [id]);

    if (domainResult.rows.length > 0) {
      entry.domainData = mapDomainRow(entry.domain, domainResult.rows[0]);
    }
  }

  if (!entry.translations) {
    await loadTranslationsForSingleEntry(entry);
  }

  return entry;
}

/**
 * Get moderation queue entries.
 */
export async function getModerationQueue(options = {}) {
  const {
    status = 'pending',
    domain = null,
    limit = 100,
    offset = 0
  } = options;

  const whereConditions = ['mq.status = $1'];
  const params = [status];
  let paramIndex = 2;

  if (domain) {
    whereConditions.push(`mq.domain = $${paramIndex++}`);
    params.push(domain);
  }

  const whereClause = whereConditions.join(' AND ');

  const queueQuery = `
    SELECT
      mq.*,
      e.title_de,
      e.url
    FROM moderation_queue mq
    LEFT JOIN entries e ON mq.entry_id = e.id
    WHERE ${whereClause}
    ORDER BY mq.created_at DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}
  `;

  const result = await query(queueQuery, [...params, limit, offset]);

  return result.rows.map((row) => {
    const diffSummary = summarizeDiff(row.diff);

    const base = {
      id: row.id,
      entryId: row.entry_id,
      domain: row.domain,
      action: row.action,
      status: row.status,
      candidateData: row.candidate_data,
      existingData: row.existing_data,
      diff: row.diff,
      diffSummary,
      importantChanges: [],
      provenance: row.provenance,
      reviewedBy: row.reviewed_by,
      reviewedAt: row.reviewed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      title: row.title_de, // Use only the string from title_de
      url: row.url
    };

    if (row.title_de) {
      base.title_de = row.title_de;
    }

    return withLegacyKeys(base, {
      entry_id: 'entryId',
      candidate_data: 'candidateData',
      existing_data: 'existingData',
      updated_at: 'updatedAt',
      created_at: 'createdAt',
      reviewed_by: 'reviewedBy',
      reviewed_at: 'reviewedAt'
    });
  });
}

/**
 * Get quality report statistics.
 */
export async function getQualityReport() {
  const domainStatsQuery = `SELECT * FROM entry_statistics`;

  const lowQualityQuery = `
    SELECT
      id,
      domain,
      title_de,
      url,
      (quality_scores->>'iqs')::numeric AS iqs,
      (quality_scores->>'ais')::numeric AS ais
    FROM entries
    WHERE
      (quality_scores->>'iqs')::numeric < 50
      OR (quality_scores->>'ais')::numeric < 50
    ORDER BY (quality_scores->>'iqs')::numeric ASC
    LIMIT 20
  `;

  const missingTranslationsQuery = `
    SELECT
      id,
      domain,
      title_de,
      url,
      CASE WHEN title_en IS NULL OR title_en = '' THEN true ELSE false END AS missing_en,
      CASE WHEN title_easy_de IS NULL OR title_easy_de = '' THEN true ELSE false END AS missing_easy_de
    FROM entries
    WHERE
      (title_en IS NULL OR title_en = '')
      OR (title_easy_de IS NULL OR title_easy_de = '')
    LIMIT 50
  `;

  const [domainStats, lowQuality, missingTranslations] = await Promise.all([
    query(domainStatsQuery),
    query(lowQualityQuery),
    query(missingTranslationsQuery)
  ]);

  return {
    byDomain: domainStats.rows,
    lowQualityEntries: lowQuality.rows,
    missingTranslations: missingTranslations.rows
  };
}

/**
 * Get system statistics.
 */
export async function getStatistics() {
  const entriesQuery = `
    SELECT domain, status, COUNT(*) AS count
    FROM entries
    GROUP BY domain, status
  `;

  const moderationQuery = `
    SELECT status, COUNT(*) AS count
    FROM moderation_queue
    GROUP BY status
  `;

  const qualityQuery = `
    SELECT
      AVG((quality_scores->>'iqs')::numeric) AS avg_iqs,
      AVG((quality_scores->>'ais')::numeric) AS avg_ais
    FROM entries
    WHERE quality_scores IS NOT NULL
  `;

  const [entriesResult, moderationResult, qualityResult] = await Promise.all([
    query(entriesQuery),
    query(moderationQuery),
    query(qualityQuery)
  ]);

  return {
    entries: entriesResult.rows,
    moderation: moderationResult.rows,
    qualityScores: qualityResult.rows[0]
  };
}

/**
 * Search entries by text.
 * Uses substring matching for title, summary, and content.
 */
export async function searchEntries(options = {}) {
  const {
    searchText,
    domain = null,
    includeTranslations = false,
    limit = 50,
    offset = 0
  } = options;

  const term = (searchText || '').trim();

  if (!term) {
    return getAllEntries({ domain, includeTranslations, limit, offset });
  }

  const whereConditions = [
    `(
      COALESCE(e.title_de, '') ILIKE $1 OR
      COALESCE(e.title_en, '') ILIKE $1 OR
      COALESCE(e.title_easy_de, '') ILIKE $1 OR
      COALESCE(e.summary_de, '') ILIKE $1 OR
      COALESCE(e.summary_en, '') ILIKE $1 OR
      COALESCE(e.summary_easy_de, '') ILIKE $1 OR
      COALESCE(e.content_de, '') ILIKE $1 OR
      COALESCE(e.content_en, '') ILIKE $1 OR
      COALESCE(e.content_easy_de, '') ILIKE $1
    )`
  ];

  const params = [`%${term}%`];
  let paramIndex = 2;

  if (domain) {
    whereConditions.push(`e.domain = $${paramIndex++}`);
    params.push(domain);
  }

  const whereClause = whereConditions.join(' AND ');

  const countQuery = `
    SELECT COUNT(*)::int AS total
    FROM entries e
    WHERE ${whereClause}
  `;

  const countResult = await query(countQuery, params);
  const total = countResult.rows[0]?.total || 0;

  const sql = `
    SELECT
      e.*,
      (e.quality_scores->>'iqs')::numeric AS iqs,
      (e.quality_scores->>'ais')::numeric AS ais
    FROM entries e
    WHERE ${whereClause}
    ORDER BY
      CASE
        WHEN COALESCE(e.title_de, '') ILIKE $1
          OR COALESCE(e.title_en, '') ILIKE $1
          OR COALESCE(e.title_easy_de, '') ILIKE $1
        THEN 0
        WHEN COALESCE(e.summary_de, '') ILIKE $1
          OR COALESCE(e.summary_en, '') ILIKE $1
          OR COALESCE(e.summary_easy_de, '') ILIKE $1
        THEN 1
        ELSE 2
      END,
      e.created_at DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}
  `;

  const result = await query(sql, [...params, limit, offset]);
  const entries = result.rows.map((row) => mapEntryRow(row, { includeTranslations }));

  if (includeTranslations) {
    await loadTranslationsForEntries(entries);
  }

  return {
    entries,
    total,
    limit,
    offset,
    page: Math.floor(offset / limit) + 1,
    pages: Math.ceil(total / limit)
  };
}

export const __private = {
  mapEntryRow,
  mapDomainRow,
  buildMultilingual,
  withLegacyKeys,
  summarizeDiff,
  attachTranslations,
  getLanguageColumns,
  buildPagination,
  loadTranslationsForDomains,
  loadTranslationsForEntries,
  loadTranslationsForSingleEntry
};

export default {
  getAllEntries,
  getEntryById,
  getModerationQueue,
  getQualityReport,
  getStatistics,
  searchEntries,
  searchEntriesForAutocomplete
};
