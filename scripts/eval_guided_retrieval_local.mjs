#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { localEvaluateEntries } from '../cloudflare-pages/functions/api/_lib/ai.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const DOMAINS = ['benefits', 'aid', 'tools', 'organizations', 'contacts'];
const DEFAULT_GOLD_FIXTURE = path.join(repoRoot, 'tests', 'fixtures', 'life_event_gold_queries.json');
const DEFAULT_RESOURCE_PACKS = path.join(repoRoot, 'data', '_topics', 'life_event_resource_packs.json');

function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function loadDomainEntries(domain) {
  const file = path.join(repoRoot, 'data', domain, 'entries.json');
  if (!fs.existsSync(file)) return [];
  const raw = loadJson(file);
  const entries = Array.isArray(raw) ? raw : Array.isArray(raw?.entries) ? raw.entries : [];
  return entries
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => ({
      ...entry,
      domain: entry.domain || domain,
      status: entry.status || 'active',
    }));
}

function loadAllEntries() {
  return DOMAINS.flatMap((domain) => loadDomainEntries(domain));
}

function loadLifeEventScenarios() {
  const file = path.join(repoRoot, 'data', '_topics', 'life_events.json');
  if (!fs.existsSync(file)) return [];
  const payload = loadJson(file);
  return Array.isArray(payload?.scenarios) ? payload.scenarios : [];
}

function loadLifeEventResourcePacks() {
  if (!fs.existsSync(DEFAULT_RESOURCE_PACKS)) return null;
  return loadJson(DEFAULT_RESOURCE_PACKS);
}

function parseQueries(argv) {
  const inline = [];
  const fileQueries = [];
  let lifeEvent = '';
  let runGold = false;
  let goldPath = DEFAULT_GOLD_FIXTURE;
  let failOnRegression = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--query' && argv[i + 1]) {
      inline.push(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg === '--file' && argv[i + 1]) {
      const file = argv[i + 1];
      const payload = loadJson(path.resolve(process.cwd(), file));
      if (Array.isArray(payload)) {
        fileQueries.push(...payload.filter((q) => typeof q === 'string'));
      }
      i += 1;
      continue;
    }
    if (arg === '--life-event' && argv[i + 1]) {
      lifeEvent = String(argv[i + 1] || '').trim();
      i += 1;
      continue;
    }
    if (arg === '--gold') {
      runGold = true;
      if (argv[i + 1] && !argv[i + 1].startsWith('--')) {
        goldPath = path.resolve(process.cwd(), argv[i + 1]);
        i += 1;
      }
      continue;
    }
    if (arg === '--fail-on-regression') {
      failOnRegression = true;
    }
  }

  if (inline.length > 0 || fileQueries.length > 0) {
    return {
      mode: 'queries',
      queries: [...inline, ...fileQueries],
      lifeEvent,
      runGold,
      goldPath,
      failOnRegression,
    };
  }

  return {
    mode: runGold ? 'gold' : 'queries',
    queries: [
      'Ich bin arbeitslos geworden. Was nun?',
      'Wie kann ich mich weiterbilden?',
      'Ich habe Kinder, welche Hilfen gibt es?',
      'Ich habe Schulden und brauche Beratung',
    ],
    lifeEvent,
    runGold,
    goldPath,
    failOnRegression,
  };
}

function printResult(query, result) {
  console.log('');
  console.log(`Query: ${query}`);
  console.log(`Detected stages: ${result.stages.length > 0 ? result.stages.join(', ') : '(none)'}`);
  console.log(`Domain focus: ${result.domains.join(', ')}`);
  if (result.expansions.length > 0) {
    console.log(`Expansion terms: ${result.expansions.join(', ')}`);
  }
  if (result.results.length === 0) {
    console.log('Top results: (none)');
    return;
  }
  console.log('Top results:');
  result.results.slice(0, 8).forEach((item, index) => {
    console.log(
      `${String(index + 1).padStart(2, ' ')}. [${item.domain}] score=${item.score.toFixed(2)} ${item.title || '(ohne titel)'}`
    );
    console.log(`    ${item.url}`);
  });
}

function includesAny(text, terms) {
  if (!Array.isArray(terms) || terms.length === 0) return true;
  const normalized = String(text || '').toLowerCase();
  return terms.some((term) => normalized.includes(String(term || '').toLowerCase()));
}

function evaluateCase(entries, scenarios, testCase) {
  const resourcePacks = loadLifeEventResourcePacks();
  const result = localEvaluateEntries(entries, testCase.query, {
    lifeEventId: testCase.life_event || undefined,
    lifeEventScenarios: scenarios,
    lifeEventResourcePacks: resourcePacks,
  });
  const topK = Math.max(1, Number(testCase.top_k || 8));
  const top = result.results.slice(0, topK);
  const corpus = top.map((item) => `${item.title || ''} ${item.url || ''}`).join(' ').toLowerCase();
  const top1 = top.length > 0 ? `${top[0].title || ''} ${top[0].url || ''}`.toLowerCase() : '';
  const topDomains = new Set(top.map((item) => String(item.domain || '')));
  const contactTexts = top
    .filter((item) => String(item.domain || '') === 'contacts')
    .map((item) => `${item.title || ''} ${item.url || ''}`)
    .join(' ')
    .toLowerCase();

  const checks = [];

  if (typeof testCase.expected_life_event === 'string' && testCase.expected_life_event.trim()) {
    checks.push({
      id: 'life_event',
      pass: result.stages.includes(testCase.expected_life_event.trim()),
      details: `expected=${testCase.expected_life_event} actual=${result.stages.join(',') || 'none'}`,
    });
  }

  if (Array.isArray(testCase.required_domains_all) && testCase.required_domains_all.length > 0) {
    const missing = testCase.required_domains_all.filter((domain) => !topDomains.has(String(domain)));
    checks.push({
      id: 'required_domains_all',
      pass: missing.length === 0,
      details: missing.length === 0 ? 'all required domains present' : `missing=${missing.join(',')}`,
    });
  }

  if (Array.isArray(testCase.required_domains_any) && testCase.required_domains_any.length > 0) {
    const present = testCase.required_domains_any.some((domain) => topDomains.has(String(domain)));
    checks.push({
      id: 'required_domains_any',
      pass: present,
      details: `topDomains=${Array.from(topDomains).join(',') || 'none'}`,
    });
  }

  if (Array.isArray(testCase.expected_terms_any) && testCase.expected_terms_any.length > 0) {
    checks.push({
      id: 'expected_terms_any',
      pass: includesAny(corpus, testCase.expected_terms_any),
      details: `terms=${testCase.expected_terms_any.join(', ')}`,
    });
    checks.push({
      id: 'expected_terms_top1',
      pass: includesAny(top1, testCase.expected_terms_any),
      details: `top1_terms=${testCase.expected_terms_any.join(', ')}`,
    });
  }

  if (Array.isArray(testCase.blocked_terms_any) && testCase.blocked_terms_any.length > 0) {
    const normalizedBlocked = testCase.blocked_terms_any.map((term) => String(term || '').toLowerCase());
    const blockedHit = normalizedBlocked.find((term) => corpus.includes(term));
    checks.push({
      id: 'blocked_terms_absent',
      pass: !blockedHit,
      details: blockedHit ? `blocked_hit=${blockedHit}` : 'none',
    });
  }

  if (Array.isArray(testCase.contact_keywords_any) && testCase.contact_keywords_any.length > 0) {
    checks.push({
      id: 'contact_keywords_any',
      pass: includesAny(contactTexts, testCase.contact_keywords_any),
      details: `contact_terms=${testCase.contact_keywords_any.join(', ')}`,
    });
  }

  const passed = checks.every((check) => check.pass);
  return { result, checks, passed };
}

function runGoldSuite(entries, scenarios, goldPath, failOnRegression) {
  if (!fs.existsSync(goldPath)) {
    throw new Error(`Gold fixture not found: ${goldPath}`);
  }
  const fixture = loadJson(goldPath);
  const cases = Array.isArray(fixture?.queries) ? fixture.queries : Array.isArray(fixture) ? fixture : [];
  if (cases.length === 0) {
    throw new Error(`Gold fixture has no queries: ${goldPath}`);
  }

  let passedCases = 0;
  let passedChecks = 0;
  let totalChecks = 0;

  console.log(`Gold suite: ${goldPath}`);
  console.log(`Cases: ${cases.length}`);

  for (const testCase of cases) {
    const { result, checks, passed } = evaluateCase(entries, scenarios, testCase);
    if (passed) passedCases += 1;
    passedChecks += checks.filter((check) => check.pass).length;
    totalChecks += checks.length;

    console.log('');
    console.log(`[${passed ? 'PASS' : 'FAIL'}] ${testCase.id || 'case'}: ${testCase.query}`);
    console.log(`  detected: ${result.stages.join(', ') || 'none'} | top domains: ${result.results.slice(0, 8).map((item) => item.domain).join(', ') || 'none'}`);
    for (const check of checks) {
      console.log(`  - ${check.pass ? 'ok' : 'x'} ${check.id}: ${check.details}`);
    }
  }

  const casePassRate = (passedCases / cases.length) * 100;
  const checkPassRate = totalChecks > 0 ? (passedChecks / totalChecks) * 100 : 100;
  console.log('');
  console.log('Summary:');
  console.log(`  case_pass: ${passedCases}/${cases.length} (${casePassRate.toFixed(1)}%)`);
  console.log(`  check_pass: ${passedChecks}/${totalChecks} (${checkPassRate.toFixed(1)}%)`);

  const failed = passedCases !== cases.length;
  if (failed && failOnRegression) {
    process.exitCode = 1;
  }
}

function main() {
  const entries = loadAllEntries();
  const scenarios = loadLifeEventScenarios();
  const parsed = parseQueries(process.argv.slice(2));

  console.log(`Loaded entries: ${entries.length}`);
  console.log(`Loaded life-event scenarios: ${scenarios.length}`);

  if (parsed.mode === 'gold' || parsed.runGold) {
    runGoldSuite(entries, scenarios, parsed.goldPath, parsed.failOnRegression);
    return;
  }

  if (parsed.lifeEvent) {
    console.log(`Forced life event: ${parsed.lifeEvent}`);
  }

  for (const query of parsed.queries) {
    const resourcePacks = loadLifeEventResourcePacks();
    const result = localEvaluateEntries(entries, query, {
      lifeEventId: parsed.lifeEvent || undefined,
      lifeEventScenarios: scenarios,
      lifeEventResourcePacks: resourcePacks,
    });
    printResult(query, result);
  }
}

main();
