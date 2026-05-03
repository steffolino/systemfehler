/**
 * Tests all 60 suggested queries against the live production API.
 * Reports which ones return 0 evidence or weak_evidence=true.
 *
 * Usage: node scripts/test_production_queries.mjs [base_url]
 * Default base_url: https://systemfehler.pages.dev
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const BASE_URL = process.argv[2] || 'https://systemfehler.pages.dev';
const RETRIEVE_URL = `${BASE_URL}/api/ai/retrieve`;
const E2E_BYPASS_TOKEN = process.env.TURNSTILE_E2E_BYPASS_TOKEN || '';
const REQUEST_DELAY_MS = Number.parseInt(process.env.REQUEST_DELAY_MS || '5500', 10);
const MAX_429_RETRIES = Number.parseInt(process.env.MAX_429_RETRIES || '5', 10);

const fixture = JSON.parse(readFileSync(resolve(ROOT, 'tests/fixtures/life_event_suggested_queries.json'), 'utf-8'));
const queries = fixture.queries;

console.log(`Testing ${queries.length} queries against ${RETRIEVE_URL}\n`);

let passCount = 0;
let failCount = 0;
const failures = [];

for (const q of queries) {
  let result;
  try {
    let attempt = 0;
    while (true) {
      const res = await fetch(RETRIEVE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(E2E_BYPASS_TOKEN ? { 'x-e2e-bypass-token': E2E_BYPASS_TOKEN } : {}),
        },
        body: JSON.stringify({ query: q.query }),
      });

      if (res.status === 429 && attempt < MAX_429_RETRIES) {
        attempt += 1;
        const retryAfter = Number.parseInt(res.headers.get('Retry-After') || '10', 10);
        const waitMs = Number.isFinite(retryAfter) ? retryAfter * 1000 : 10000;
        console.log(`[RETRY] ${q.id} hit 429, waiting ${waitMs}ms (attempt ${attempt}/${MAX_429_RETRIES})`);
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }

      result = await res.json();
      break;
    }
  } catch (err) {
    console.error(`[ERROR] ${q.id}: ${err.message}`);
    failCount++;
    failures.push({ id: q.id, query: q.query, reason: `fetch error: ${err.message}` });
    continue;
  }

  const evidenceCount = Array.isArray(result.evidence) ? result.evidence.length : 0;
  const weak = Boolean(result.weak_evidence);
  const detected = result.retrieval?.detected_stages?.join(',') || 'none';

  if (evidenceCount === 0 || weak) {
    const reason = evidenceCount === 0 ? '0 evidence' : 'weak_evidence=true';
    console.log(`[FAIL] ${q.id} (${reason}, detected=${detected})`);
    console.log(`       query: ${q.query}`);
    failCount++;
    failures.push({ id: q.id, query: q.query, reason, evidenceCount, detected });
  } else {
    console.log(`[PASS] ${q.id} — ${evidenceCount} entries, detected=${detected}`);
    passCount++;
  }

  // Keep traffic under the endpoint rate limit for consistent E2E results.
  await new Promise(r => setTimeout(r, REQUEST_DELAY_MS));
}

console.log(`\nResults: ${passCount}/${queries.length} passed`);
if (failures.length > 0) {
  console.log(`\nFailed queries (${failures.length}):`);
  for (const f of failures) {
    console.log(`  - [${f.id}] ${f.reason}`);
    console.log(`    "${f.query}"`);
  }
  process.exit(1);
} else {
  console.log('All queries returned strong evidence in production.');
}
