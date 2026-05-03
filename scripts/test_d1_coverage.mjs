/**
 * Tests D1 coverage for all 60 suggested queries by running the same
 * keyword lookups the production retrieve endpoint would run.
 * Does NOT require Turnstile — queries D1 directly via wrangler.
 *
 * Usage: node scripts/test_d1_coverage.mjs
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ---------- helpers copied from ai.js ----------

const QUERY_STOPWORDS = new Set([
  'der','die','das','den','dem','des','ein','eine','einer','einem','einen',
  'und','oder','aber','doch','dass','weil','ich','du','er','sie','wir','ihr',
  'mir','mich','dir','dich','uns','euch','ist','sind','war','waren','wird',
  'werden','mit','ohne','fuer','auf','bei','von','zu','im','in','am','an',
  'was','wie','wo','wer','wann','warum','wieso','weshalb','nun','jetzt',
  'heute','morgen','gestern','bitte','danke','hallo',
]);

function normalizeGermanChars(str) {
  return str.replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss');
}

function normalizedQueryTokens(query) {
  return (query || '').toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => t.length >= 3 && !QUERY_STOPWORDS.has(t));
}

function d1Query(sql) {
  const escaped = sql.replace(/"/g, '\\"');
  const out = execSync(
    `npx wrangler d1 execute systemfehler-db --remote --json --command="${escaped}" --cwd cloudflare-pages`,
    { encoding: 'utf-8', stdio: ['pipe','pipe','pipe'] }
  );
  const parsed = JSON.parse(out);
  return Array.isArray(parsed) ? parsed[0]?.results ?? [] : [];
}

// ---------- load scenarios ----------

const scenarios = JSON.parse(
  readFileSync(resolve(ROOT, 'data/_topics/life_events.json'), 'utf-8')
).scenarios;

const scenarioMap = Object.fromEntries(scenarios.map(s => [s.id, s]));

// ---------- load fixture ----------

const fixture = JSON.parse(
  readFileSync(resolve(ROOT, 'tests/fixtures/life_event_suggested_queries.json'), 'utf-8')
);

console.log(`Checking D1 coverage for ${fixture.queries.length} queries...\n`);

let pass = 0, fail = 0;
const failures = [];

for (const q of fixture.queries) {
  const scenario = scenarioMap[q.expected_life_event];
  const expansions = scenario?.expansions ?? [];

  const expandedQuery = `${q.query} ${expansions.join(' ')}`.trim();
  const tokens = [...new Set(normalizedQueryTokens(expandedQuery))].slice(0, 12);
  const domains = scenario?.domains ?? ['benefits','aid','contacts','tools'];
  const domainList = domains.map(d => `'${d}'`).join(',');

  const clauses = tokens.map(() =>
    `(LOWER(entry_json) LIKE LOWER(?) OR LOWER(title_de) LIKE LOWER(?))`
  );
  const needles = tokens.flatMap(t => [`%${t}%`, `%${t}%`]);

  // Build and run the SQL
  let cnt = 0;
  try {
    const whereParts = tokens.map(t =>
      `(LOWER(entry_json) LIKE '%${normalizeGermanChars(t)}%' OR LOWER(title_de) LIKE '%${normalizeGermanChars(t)}%')`
    );
    const sql = `SELECT COUNT(*) as cnt FROM entries WHERE status='active' AND domain IN (${domainList}) AND (${whereParts.join(' OR ')})`;
    const rows = d1Query(sql);
    cnt = rows[0]?.cnt ?? 0;
  } catch (err) {
    console.log(`[ERROR] ${q.id}: ${err.message.slice(0, 80)}`);
    fail++;
    failures.push({ id: q.id, query: q.query, reason: 'D1 error' });
    continue;
  }

  if (cnt === 0) {
    console.log(`[FAIL] ${q.id} — 0 D1 rows matched`);
    console.log(`       scenario=${q.expected_life_event}, tokens=[${tokens.slice(0,5).join(', ')}]`);
    fail++;
    failures.push({ id: q.id, query: q.query, reason: '0 D1 rows', tokens: tokens.slice(0,5) });
  } else {
    console.log(`[PASS] ${q.id} — ${cnt} D1 rows (${q.expected_life_event})`);
    pass++;
  }
}

console.log(`\nResults: ${pass}/${fixture.queries.length} have D1 coverage`);
if (failures.length > 0) {
  console.log(`\nNo D1 data for (${failures.length} queries):`);
  for (const f of failures) {
    console.log(`  [${f.id}] ${f.reason} — tokens: ${(f.tokens||[]).join(', ')}`);
  }
  process.exit(1);
}
