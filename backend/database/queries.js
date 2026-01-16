/**
 * Database Query Layer
 * 
 * Encapsulates all SQL queries for the application
 */

import { query } from './connection.js';

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
  
  return {
    entries: entriesResult.rows,
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
  
  const entry = result.rows[0];
  
  // Fetch domain-specific data
  const domainTable = entry.domain;
  if (domainTable) {
    const domainQuery = `SELECT * FROM ${domainTable} WHERE entry_id = $1`;
    const domainResult = await query(domainQuery, [id]);
    
    if (domainResult.rows.length > 0) {
      entry.domainData = domainResult.rows[0];
    }
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
  
  let whereConditions = ['status = $1'];
  let params = [status];
  let paramIndex = 2;
  
  if (domain) {
    whereConditions.push(`domain = $${paramIndex++}`);
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
  
  return result.rows;
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
