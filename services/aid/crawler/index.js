/**
 * Systemfehler - Aid Domain Crawler
 * 
 * This crawler fetches and extracts aid program information from 
 * government and NGO websites.
 * 
 * @see CRAWL-01 (Issue #4) - Uses shared base crawler module
 */

import { fetchPage, extractText, createLogger } from '../../_shared/crawler_base.js';

const logger = createLogger('aid-crawler');

/**
 * TODO: Implement aid crawler following the pattern established in CRAWL-02:
 * 
 * 1. Read URLs from data/aid/urls.json
 * 2. Apply extraction rules from config/extraction_rules.json
 * 3. Generate candidate entries matching aid.schema.json
 * 4. Output to moderation queue with diffs
 */

export const crawlAid = async (options = {}) => {
  logger.info('Starting aid crawl...');
  
  // TODO: Implement aid crawling
  throw new Error('Not implemented - follow CRAWL-02 pattern');
};

import { fileURLToPath } from 'url';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  crawlAid().catch(err => {
    console.error('Crawler error:', err.message);
    process.exit(1);
  });
}
