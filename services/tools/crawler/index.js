/**
 * ============================================================
 * REFERENCE ONLY – NOT THE ACTIVE CRAWLER IMPLEMENTATION
 * ============================================================
 * Node crawler code in services/ is design scaffolding only.
 * The canonical crawling implementation is the Python pipeline.
 *
 * A Python crawler for the tools domain does not exist yet.
 * To add one, follow the pattern in:
 *   crawlers/benefits/arbeitsagentur_crawler.py
 * and register it in crawlers/cli.py.
 *
 * See docs/status.md for the full list of working commands.
 * ============================================================
 *
 * Systemfehler - Tools Domain Crawler
 * 
 * This crawler fetches and extracts information about tools,
 * calculators, and forms from government websites.
 * 
 * @see CRAWL-01 (Issue #4) - Uses shared base crawler module
 * @see docs/status.md - Canonical implementation status
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
  throw new Error(
    'Not implemented (Node stub – reference only). ' +
    'No Python crawler exists for the tools domain yet. ' +
    'See crawlers/benefits/arbeitsagentur_crawler.py for the pattern to follow.'
  );
};

import { fileURLToPath } from 'url';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  crawlTools().catch(err => {
    console.error('Crawler error:', err.message);
    process.exit(1);
  });
}
