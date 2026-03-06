/**
 * ============================================================
 * REFERENCE ONLY – NOT THE ACTIVE CRAWLER IMPLEMENTATION
 * ============================================================
 * Node crawler code in services/ is design scaffolding only.
 * The canonical crawling implementation is the Python pipeline.
 *
 * A Python crawler for the organizations domain does not exist yet.
 * To add one, follow the pattern in:
 *   crawlers/benefits/arbeitsagentur_crawler.py
 * and register it in crawlers/cli.py.
 *
 * See docs/status.md for the full list of working commands.
 * ============================================================
 *
 * Systemfehler - Organizations Domain Crawler
 * 
 * This crawler fetches and extracts organization information from
 * directories and institutional websites.
 * 
 * @see CRAWL-01 (Issue #4) - Uses shared base crawler module
 * @see docs/status.md - Canonical implementation status
 */

import { fetchPage, extractText, createLogger } from '../../_shared/crawler_base.js';

const logger = createLogger('organizations-crawler');

/**
 * TODO: Implement organizations crawler following the pattern established in CRAWL-02:
 * 
 * 1. Read URLs from data/organizations/urls.json
 * 2. Apply extraction rules from config/extraction_rules.json
 * 3. Generate candidate entries matching organizations.schema.json
 * 4. Output to moderation queue with diffs
 */

export const crawlOrganizations = async (options = {}) => {
  logger.info('Starting organizations crawl...');
  
  // TODO: Implement organizations crawling
  throw new Error(
    'Not implemented (Node stub – reference only). ' +
    'No Python crawler exists for the organizations domain yet. ' +
    'See crawlers/benefits/arbeitsagentur_crawler.py for the pattern to follow.'
  );
};

import { fileURLToPath } from 'url';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  crawlOrganizations().catch(err => {
    console.error('Crawler error:', err.message);
    process.exit(1);
  });
}
