/**
 * Systemfehler - Shared Crawler Base Module
 * 
 * This module provides the foundation for all domain-specific crawlers.
 * It includes HTML fetching, text extraction, URL normalization, error handling,
 * logging, and deduplication functionality.
 * 
 * @see CRAWL-01 (Issue #4) - Implement shared base crawler module
 * @see docs/architecture.md - Section 2.5 Preservation-Oriented Crawling
 */

/**
 * TODO: Implement the following components per CRAWL-01 (Issue #4):
 * 
 * 1. HTTP Fetching with retry and timeout logic
 *    - Support configurable timeouts
 *    - Implement exponential backoff for retries
 *    - Handle common HTTP errors gracefully
 *    - Respect robots.txt directives
 * 
 * 2. HTML Parsing and Text Extraction
 *    - Clean HTML and extract meaningful text
 *    - Handle different character encodings
 *    - Strip navigation, headers, footers
 * 
 * 3. URL Normalization
 *    - Remove tracking parameters
 *    - Handle redirects
 *    - Canonicalize URLs consistently
 *    - See CRAWL-06 (Issue #30) for detailed requirements
 * 
 * 4. Logging
 *    - Consistent log format across all crawlers
 *    - Log levels: debug, info, warn, error
 *    - Include timestamps and crawler context
 * 
 * 5. Deduplication
 *    - Content-based deduplication using checksums
 *    - URL-based duplicate detection
 *    - See DATA-06 (Issue #32) for merge strategy
 */

// Placeholder exports - implement per CRAWL-01
export const fetchPage = async (url, options = {}) => {
  // TODO: Implement HTTP fetching with retry logic
  throw new Error('Not implemented - see CRAWL-01 (Issue #4)');
};

export const extractText = (element, clean = true) => {
  // Generic extractor: supports cheerio-like elements or plain strings
  if (!element) return '';
  if (typeof element === 'string') {
    const text = element;
    return clean ? text.replace(/\s+/g, ' ').trim() : text;
  }
  // cheerio/jQuery-like element
  try {
    if (typeof element.text === 'function') {
      const text = element.text();
      return clean ? text.replace(/\s+/g, ' ').trim() : text;
    }
    if (element.get && typeof element.get === 'function') {
      const text = element.get(0) && element.get(0).textContent ? element.get(0).textContent : '';
      return clean ? text.replace(/\s+/g, ' ').trim() : text;
    }
  } catch (e) {
    return '';
  }
  return '';
};

export const normalizeUrl = (url) => {
  // Basic normalization fallback used by services; for full normalization
  // the dedicated url_normalization module should be used.
  try {
    const u = new URL(url);
    u.hash = '';
    // remove common tracking params
    const tracking = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','fbclid','gclid','ref','source'];
    tracking.forEach(p => u.searchParams.delete(p));
    // remove trailing slash on path except root
    if (u.pathname !== '/' && u.pathname.endsWith('/')) u.pathname = u.pathname.slice(0, -1);
    return u.toString();
  } catch (e) {
    return url;
  }
};

export const createLogger = (crawlerName) => {
  // TODO: Implement consistent logging
  return {
    debug: (...args) => console.debug(`[${crawlerName}]`, ...args),
    info: (...args) => console.info(`[${crawlerName}]`, ...args),
    warn: (...args) => console.warn(`[${crawlerName}]`, ...args),
    error: (...args) => console.error(`[${crawlerName}]`, ...args),
  };
};

export const computeChecksum = (content) => {
  // Simple SHA-256 checksum using built-in SubtleCrypto when available
  try {
    if (typeof content !== 'string') content = JSON.stringify(content);
    if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
      // Return a promise to be consistent with async callers
      return crypto.subtle.digest('SHA-256', new TextEncoder().encode(content)).then(buf => {
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
      });
    }
  } catch (e) {
    // Fallthrough to node fallback below
  }
  // Node.js fallback (synchronous) if crypto module is available
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createHash } = require('crypto');
    return createHash('sha256').update(String(content)).digest('hex');
  } catch (e) {
    return null;
  }
};

// ------------------------------
// Title / Head helpers (JS)
// ------------------------------
export const _isNavLike = (element) => {
  if (!element) return false;
  try {
    let parent = element.parent;
    while (parent) {
      const name = parent.name || (parent.tagName && parent.tagName.toLowerCase());
      if (name && ['nav','header','footer','aside'].includes(name)) return true;
      const cls = (parent.attribs && parent.attribs.class) ? parent.attribs.class.toLowerCase() : '';
      const id = (parent.attribs && parent.attribs.id) ? parent.attribs.id.toLowerCase() : '';
      if (/(nav|navigation|menu|hauptnavigation|breadcrumb)/.test(cls)) return true;
      if (/(nav|navigation|menu|hauptnavigation|breadcrumb)/.test(id)) return true;
      parent = parent.parent;
    }
  } catch (e) {
    return false;
  }
  return false;
};

export const _extractMetaTag = (root, keys = []) => {
  if (!root || !keys || keys.length === 0) return '';
  try {
    const head = root('head');
    if (!head) return '';
    const lookup = keys.map(k => k.toLowerCase());
    let found = '';
    head.find('meta').each((i, meta) => {
      if (found) return;
      const name = (meta.attribs && (meta.attribs.name || meta.attribs.property) || '').toLowerCase();
      if (!lookup.includes(name)) return;
      const content = (meta.attribs && meta.attribs.content) || '';
      if (content) found = content.trim();
    });
    return found;
  } catch (e) {
    return '';
  }
};

export const _extractHeadTitle = (root) => {
  if (!root) return '';
  try {
    const title = root('title').first();
    if (title && title.text) return title.text().trim();
    return _extractMetaTag(root, ['og:title', 'twitter:title']) || '';
  } catch (e) {
    return '';
  }
};

export const _getBestTitle = (root, seedName = '', url = '') => {
  if (!root) return seedName || url || '';
  try {
    const h1 = root('h1').first();
    if (h1 && h1.text && !_isNavLike(h1[0])) {
      const txt = h1.text().trim();
      if (txt && !/^(navigation|hauptnavigation|haupt-navigation)$/i.test(txt)) return txt;
    }
    const headTitle = _extractHeadTitle(root);
    if (headTitle) return headTitle;
    const metaTitle = _extractMetaTag(root, ['og:title', 'twitter:title']);
    if (metaTitle) return metaTitle;
    const metaDesc = _extractMetaTag(root, ['description', 'og:description', 'twitter:description']);
    if (metaDesc) return metaDesc.length > 60 ? metaDesc.slice(0,60) + '...' : metaDesc;
  } catch (e) {
    // ignore
  }
  return seedName || url || '';
};
