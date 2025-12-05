/**
 * Systemfehler - Tools Domain Crawler
 * 
 * This crawler fetches and extracts information about tools,
 * calculators, and forms from government websites.
 * 
 * @see CRAWL-01 (Issue #4) - Uses shared base crawler module
 */

import { fetchPage, extractText, createLogger } from '../../_shared/crawler_base.js';

const logger = createLogger('tools-crawler');

/**
 * TODO: Implement tools crawler following the pattern established in CRAWL-02:
 * 
 * 1. Read URLs from data/tools/urls.json
 * 2. Apply extraction rules from config/extraction_rules.json
 * 3. Generate candidate entries matching tools.schema.json
 * 4. Output to moderation queue with diffs
 */

export const crawlTools = async (options = {}) => {
  logger.info('Starting tools crawl...');
  
  // TODO: Implement tools crawling
  throw new Error('Not implemented - follow CRAWL-02 pattern');
};

import { fileURLToPath } from 'url';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  crawlTools().catch(err => {
    console.error('Crawler error:', err.message);
    process.exit(1);
  });
}
