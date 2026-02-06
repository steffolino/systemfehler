/**
 * Database Query Layer
 * 
 * Encapsulates all SQL queries for the application
 */

import { query } from './connection.js';
import fs from 'fs/promises';
import path from 'path';

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

function mapEntryRow(row) {
  const title = buildMultilingual({
    de: row.title_de,
    en: row.title_en,
    easyDe: row.title_easy_de
  });
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
    translations: null,
    translationLanguages: []
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

function attachTranslations(entries, map) {
  entries.forEach((entry) => {
    if (map[entry.id]) {
      entry.translations = map[entry.id];
      entry.translationLanguages = Object.keys(map[entry.id]);
    } else {
      entry.translations = null;
      entry.translationLanguages = [];
    }
  });
}

/**
 * Get all entries with optional filtering
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Entries and metadata
 */
export async function getAllEntries(options = {}) {
  const {
    domain = null,
    status = null,
    limit = 50,
    offset = 0
  } = options;
  
  let whereConditions = [];
  let params = [];
  let paramIndex = 1;
  
  if (domain) {
    whereConditions.push(`domain = $${paramIndex++}`);
    params.push(domain);
  }
  
  if (status) {
    whereConditions.push(`status = $${paramIndex++}`);
    params.push(status);
  }
  
  const whereClause = whereConditions.length > 0 
    ? `WHERE ${whereConditions.join(' AND ')}`
    : '';
  
  // Get total count
  const countQuery = `SELECT COUNT(*) FROM entries ${whereClause}`;
  const countResult = await query(countQuery, params);
  const total = parseInt(countResult.rows[0].count);
  
  // Get entries
  params.push(limit, offset);
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
  
  const entriesResult = await query(entriesQuery, params);
  let entries = entriesResult.rows.map(mapEntryRow);

  if (options.includeTranslations) {
    const domains = {};
    entries.forEach((entry) => {
      if (!domains[entry.domain]) domains[entry.domain] = [];
      domains[entry.domain].push(entry.id);
    });

    const translationsMap = {};
    for (const domain of Object.keys(domains)) {
      try {
        const filePath = path.resolve(process.cwd(), 'data', domain, 'entries.json');
        const txt = await fs.readFile(filePath, 'utf8');
        const parsed = JSON.parse(txt || '{}');
        const arr = Array.isArray(parsed) ? parsed : parsed.entries || [];
        if (Array.isArray(arr)) {
          arr.forEach((entry) => {
            if (entry && entry.id && entry.translations) {
              translationsMap[entry.id] = entry.translations;
            }
          });
        }
      } catch (err) {
        // ignore missing domains or parse errors
      }
    }

    attachTranslations(entries, translationsMap);
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

/**
 * Get entry by ID with domain-specific data
 * @param {string} id - Entry UUID
 * @returns {Promise<Object|null>} Entry with domain data
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
  const entry = mapEntryRow(entryRow);
  
  // Fetch domain-specific data
  const domainTable = entry.domain;
  if (domainTable) {
    const domainQuery = `SELECT * FROM ${domainTable} WHERE entry_id = $1`;
    const domainResult = await query(domainQuery, [id]);
    
    if (domainResult.rows.length > 0) {
      entry.domainData = mapDomainRow(domainTable, domainResult.rows[0]);
    }
  }

  // Try to attach translations from JSON snapshot if present
  try {
    const filePath = path.resolve(process.cwd(), 'data', entry.domain, 'entries.json');
    const txt = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(txt || '{}');
    const arr = Array.isArray(parsed) ? parsed : parsed.entries || [];
    if (Array.isArray(arr)) {
      const s = arr.find(e => e && e.id === id);
      if (s && s.translations) {
        entry.translations = s.translations;
        entry.translationLanguages = Object.keys(s.translations);
      }
    }
  } catch (err) {
    // ignore read/parsing errors
  }

  return entry;
}

/**
 * Get moderation queue entries
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Queue entries
 */
export async function getModerationQueue(options = {}) {
  const {
    status = 'pending',
    domain = null,
    limit = 100,
    offset = 0
  } = options;
  
  // qualify columns with table alias to avoid ambiguity
  let whereConditions = ['mq.status = $1'];
  let params = [status];
  let paramIndex = 2;
  
  if (domain) {
    whereConditions.push(`mq.domain = $${paramIndex++}`);
    params.push(domain);
  }
  
  const whereClause = whereConditions.join(' AND ');
  
  params.push(limit, offset);
  
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
  
  const result = await query(queueQuery, params);

  return result.rows.map((row) => {
    const base = {
    id: row.id,
    entryId: row.entry_id,
    domain: row.domain,
    action: row.action,
    status: row.status,
    candidateData: row.candidate_data,
    existingData: row.existing_data,
    diff: row.diff,
    provenance: row.provenance,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    title: row.title_de ? { de: row.title_de } : undefined,
    url: row.url
    };

    if (row.title_de) {
      base.title_de = row.title_de;
    }

    return withLegacyKeys(base, {
    entry_id: 'entryId',
    candidate_data: 'candidateData',
    existing_data: 'existingData',
    created_at: 'createdAt',
    reviewed_by: 'reviewedBy',
      reviewed_at: 'reviewedAt'
    });
  });
}

/**
 * Get quality report statistics
 * @returns {Promise<Object>} Quality statistics
 */
export async function getQualityReport() {
  // Get statistics by domain
  const domainStatsQuery = `
    SELECT * FROM entry_statistics
  `;
  
  const domainStats = await query(domainStatsQuery);
  
  // Get entries with low quality scores
  const lowQualityQuery = `
    SELECT 
      id, domain, title_de, url,
      (quality_scores->>'iqs')::numeric AS iqs,
      (quality_scores->>'ais')::numeric AS ais
    FROM entries
    WHERE 
      (quality_scores->>'iqs')::numeric < 50
      OR (quality_scores->>'ais')::numeric < 50
    ORDER BY (quality_scores->>'iqs')::numeric ASC
    LIMIT 20
  `;
  
  const lowQuality = await query(lowQualityQuery);
  
  // Get entries with missing translations
  const missingTranslationsQuery = `
    SELECT 
      id, domain, title_de, url,
      CASE WHEN title_en IS NULL OR title_en = '' THEN true ELSE false END AS missing_en,
      CASE WHEN title_easy_de IS NULL OR title_easy_de = '' THEN true ELSE false END AS missing_easy_de
    FROM entries
    WHERE 
      (title_en IS NULL OR title_en = '')
      OR (title_easy_de IS NULL OR title_easy_de = '')
    LIMIT 50
  `;
  
  const missingTranslations = await query(missingTranslationsQuery);
  
  return {
    byDomain: domainStats.rows,
    lowQualityEntries: lowQuality.rows,
    missingTranslations: missingTranslations.rows
  };
}

/**
 * Get system statistics
 * @returns {Promise<Object>} System statistics
 */
export async function getStatistics() {
  // Total entries by domain
  const entriesQuery = `
    SELECT domain, status, COUNT(*) as count
    FROM entries
    GROUP BY domain, status
  `;
  
  const entriesResult = await query(entriesQuery);
  
  // Moderation queue statistics
  const moderationQuery = `
    SELECT status, COUNT(*) as count
    FROM moderation_queue
    GROUP BY status
  `;
  
  const moderationResult = await query(moderationQuery);
  
  // Average quality scores
  const qualityQuery = `
    SELECT 
      AVG((quality_scores->>'iqs')::numeric) as avg_iqs,
      AVG((quality_scores->>'ais')::numeric) as avg_ais
    FROM entries
    WHERE quality_scores IS NOT NULL
  `;
  
  const qualityResult = await query(qualityQuery);
  
  return {
    entries: entriesResult.rows,
    moderation: moderationResult.rows,
    qualityScores: qualityResult.rows[0]
  };
}

/**
 * Search entries by text
 * @param {Object} options - Search options
 * @returns {Promise<Object>} Search results
 */
export async function searchEntries(options = {}) {
  const {
    searchText,
    domain = null,
    language = 'german',
    limit = 50,
    offset = 0
  } = options;
  
  if (!searchText) {
    return getAllEntries({ domain, limit, offset });
  }
  
  const langConfig = language === 'english' ? 'english' : 'german';
  const titleCol = language === 'english' ? 'title_en' : 'title_de';
  const summaryCol = language === 'english' ? 'summary_en' : 'summary_de';
  const contentCol = language === 'english' ? 'content_en' : 'content_de';
  
  let whereConditions = [`
    (
      to_tsvector('${langConfig}', COALESCE(${titleCol}, '')) ||
      to_tsvector('${langConfig}', COALESCE(${summaryCol}, '')) ||
      to_tsvector('${langConfig}', COALESCE(${contentCol}, ''))
    ) @@ plainto_tsquery('${langConfig}', $1)
  `];
  
  let params = [searchText];
  let paramIndex = 2;
  
  if (domain) {
    whereConditions.push(`domain = $${paramIndex++}`);
    params.push(domain);
  }
  
  const whereClause = whereConditions.join(' AND ');
  
  params.push(limit, offset);
  
  const searchQuery = `
    SELECT 
      e.*,
      (e.quality_scores->>'iqs')::numeric AS iqs,
      (e.quality_scores->>'ais')::numeric AS ais,
      ts_rank(
        to_tsvector('${langConfig}', COALESCE(${titleCol}, '') || ' ' || COALESCE(${summaryCol}, '')),
        plainto_tsquery('${langConfig}', $1)
      ) AS rank
    FROM entries e
    WHERE ${whereClause}
    ORDER BY rank DESC, e.created_at DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}
  `;
  
  const result = await query(searchQuery, params);
  
  return {
    entries: result.rows,
    total: result.rows.length,
    limit,
    offset
  };
}

export default {
  getAllEntries,
  getEntryById,
  getModerationQueue,
  getQualityReport,
  getStatistics,
  searchEntries
};
