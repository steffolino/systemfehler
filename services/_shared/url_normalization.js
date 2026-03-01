/**
 * Systemfehler - URL Normalization Module
 * 
 * This module provides URL canonicalization and duplicate detection
 * to ensure consistent URL handling across all crawlers.
 * 
 * @see CRAWL-06 (Issue #30) - Implement URL canonicalization and duplicate detection
 */

/**
 * TODO: Implement the following per CRAWL-06 (Issue #30):
 * 
 * 1. URL Canonicalization Rules
 *    - Lowercase hostname
 *    - Remove default ports (80, 443)
 *    - Sort query parameters alphabetically
 *    - Remove tracking parameters (utm_*, fbclid, etc.)
 *    - Normalize path (remove trailing slashes, resolve ./ and ../)
 *    - Handle language variants (/de/, /en/, etc.)
 * 
 * 2. Redirect Resolution
 *    - Follow redirect chains
 *    - Store final canonical URL
 *    - Handle common redirect patterns
 * 
 * 3. Duplicate Detection
 *    - Compare normalized URLs
 *    - Detect content duplicates across different URLs
 *    - Handle language-specific duplicates
 * 
 * 4. URL Validation
 *    - Verify URL format
 *    - Check domain against allowed sources
 *    - Validate against registered_sources.json
 */

// Tracking parameters to remove
const TRACKING_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'ref', 'source', 'mc_cid', 'mc_eid'
];

const TRACKING_PREFIXES = ['utm_'];

function normalizePathname(pathname) {
  if (!pathname) return '/';

  const parts = pathname.split('/');
  const stack = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') {
      stack.pop();
      continue;
    }
    stack.push(part);
  }

  const normalized = `/${stack.join('/')}`;
  return normalized !== '/' && normalized.endsWith('/')
    ? normalized.slice(0, -1)
    : normalized;
}

function isTrackingParam(name) {
  const lower = name.toLowerCase();
  if (TRACKING_PARAMS.includes(lower)) return true;
  return TRACKING_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

export const canonicalizeUrl = (url) => {
  let parsed;
  try {
    parsed = new URL(url);
  } catch (error) {
    throw new Error(`Invalid URL: ${url}`);
  }

  const protocol = parsed.protocol.toLowerCase();
  const hostname = parsed.hostname.toLowerCase();

  const isDefaultPort =
    (protocol === 'http:' && parsed.port === '80') ||
    (protocol === 'https:' && parsed.port === '443');
  const port = isDefaultPort ? '' : parsed.port;

  const params = [];
  for (const [key, value] of parsed.searchParams.entries()) {
    if (!isTrackingParam(key)) {
      params.push([key, value]);
    }
  }
  params.sort((a, b) => {
    if (a[0] === b[0]) return a[1].localeCompare(b[1]);
    return a[0].localeCompare(b[0]);
  });

  const query = new URLSearchParams();
  for (const [key, value] of params) {
    query.append(key, value);
  }

  const canonical = new URL(`${protocol}//${hostname}${port ? `:${port}` : ''}`);
  canonical.pathname = normalizePathname(parsed.pathname);
  canonical.hash = '';
  canonical.search = query.toString();

  return canonical.toString();
};

export const removeTrackingParams = (url) => {
  let parsed;
  try {
    parsed = new URL(url);
  } catch (error) {
    throw new Error(`Invalid URL: ${url}`);
  }

  const filtered = new URL(parsed.toString());
  for (const key of [...filtered.searchParams.keys()]) {
    if (isTrackingParam(key)) {
      filtered.searchParams.delete(key);
    }
  }

  return filtered.toString();
};

export const resolveRedirects = async (url) => {
  return canonicalizeUrl(url);
};

export const detectDuplicate = (url, existingUrls) => {
  const canonicalUrl = canonicalizeUrl(url);
  const canonicalMap = new Map();

  for (const candidate of existingUrls || []) {
    try {
      canonicalMap.set(canonicalizeUrl(candidate), candidate);
    } catch (error) {
      // ignore invalid existing URL values
    }
  }

  const matchedUrl = canonicalMap.get(canonicalUrl) || null;
  return {
    isDuplicate: Boolean(matchedUrl),
    canonicalUrl,
    matchedUrl
  };
};

export const validateUrl = (url, allowedSources) => {
  const errors = [];
  let canonicalUrl = null;

  try {
    canonicalUrl = canonicalizeUrl(url);
  } catch (error) {
    errors.push(error.message);
    return { valid: false, canonicalUrl: null, errors };
  }

  const parsed = new URL(canonicalUrl);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    errors.push('URL protocol must be http or https');
  }

  if (Array.isArray(allowedSources) && allowedSources.length > 0) {
    const allowed = allowedSources.some((source) => {
      const host = String(source).toLowerCase();
      return parsed.hostname === host || parsed.hostname.endsWith(`.${host}`);
    });

    if (!allowed) {
      errors.push(`URL host '${parsed.hostname}' is not in allowed sources`);
    }
  }

  return {
    valid: errors.length === 0,
    canonicalUrl,
    errors
  };
};
