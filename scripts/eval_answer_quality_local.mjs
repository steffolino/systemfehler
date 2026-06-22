#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  evaluateAnswerGrounding,
  extractiveSynthesisAnswer,
  localEvaluateEntries,
} from '../cloudflare-pages/functions/api/_lib/ai.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const DOMAINS = ['benefits', 'aid', 'tools', 'organizations', 'contacts'];
const DEFAULT_FIXTURE = path.join(repoRoot, 'tests', 'fixtures', 'answer_quality_cases.json');
const DEFAULT_RESOURCE_PACKS = path.join(repoRoot, 'data', '_topics', 'life_event_resource_packs.json');
const DEFAULT_TOPIC_LINKS = path.join(repoRoot, 'data', '_topics', 'topic_links.json');

function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function normalizeGermanChars(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss');
}

function normalizedIncludes(text, term) {
  return normalizeGermanChars(text).includes(normalizeGermanChars(term));
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

function loadTopicLinks() {
  if (!fs.existsSync(DEFAULT_TOPIC_LINKS)) return null;
  return loadJson(DEFAULT_TOPIC_LINKS);
}

function parseArgs(argv) {
  const options = {
    fixture: DEFAULT_FIXTURE,
    caseId: '',
    endpoint: '',
    failOnRegression: false,
    showAnswer: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--fixture' && argv[i + 1]) {
      options.fixture = path.resolve(process.cwd(), argv[i + 1]);
      i += 1;
    } else if (arg === '--case' && argv[i + 1]) {
      options.caseId = String(argv[i + 1] || '').trim();
      i += 1;
    } else if (arg === '--endpoint' && argv[i + 1]) {
      options.endpoint = String(argv[i + 1] || '').replace(/\/$/, '');
      i += 1;
    } else if (arg === '--fail-on-regression') {
      options.failOnRegression = true;
    } else if (arg === '--show-answer') {
      options.showAnswer = true;
    }
  }

  return options;
}

function resultToEvidence(results, entriesById, topK) {
  return results.slice(0, topK).map((item) => {
    const entry = entriesById.get(item.id) || {
      id: item.id,
      title: item.title,
      url: item.url,
      domain: item.domain,
      summary: { de: item.summary || item.title },
      content: { de: item.content || item.summary || item.title },
    };
    return {
      source: entry.url || item.url || '',
      confidence: Math.max(0.1, Math.min(0.95, Number(item.score || 0) / 30)),
      content: JSON.stringify(entry),
    };
  });
}

async function synthesizeWithEndpoint(endpoint, testCase) {
  const response = await fetch(`${endpoint}/api/ai/synthesize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: testCase.query,
      life_event: testCase.life_event || undefined,
      retrieval_mode: testCase.retrieval_mode || 'hybrid',
    }),
  });
  if (!response.ok) {
    throw new Error(`endpoint returned ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

function checkCase(testCase, answerPayload, evidence) {
  const answer = String(answerPayload.answer || answerPayload.explanation || '');
  const sources = [
    ...(Array.isArray(answerPayload.sources) ? answerPayload.sources : []),
    ...evidence.map((item) => item.source),
  ].join(' ');
  const answerAndSources = `${answer}\n${sources}`;
  const grounding = answerPayload.answer_quality || evaluateAnswerGrounding(answer, evidence, testCase.query);
  const checks = [];

  const mustMentionAny = Array.isArray(testCase.must_mention_any) ? testCase.must_mention_any : [];
  if (mustMentionAny.length > 0) {
    const hits = mustMentionAny.filter((term) => normalizedIncludes(answer, term));
    checks.push({
      id: 'must_mention_any',
      pass: hits.length > 0,
      details: hits.length > 0 ? `hit=${hits.join(', ')}` : `missing_any=${mustMentionAny.join(', ')}`,
    });
  }

  const mustMentionAll = Array.isArray(testCase.must_mention_all) ? testCase.must_mention_all : [];
  if (mustMentionAll.length > 0) {
    const missing = mustMentionAll.filter((term) => !normalizedIncludes(answer, term));
    checks.push({
      id: 'must_mention_all',
      pass: missing.length === 0,
      details: missing.length === 0 ? 'all present' : `missing=${missing.join(', ')}`,
    });
  }

  const requiredSourcesAny = Array.isArray(testCase.required_sources_any) ? testCase.required_sources_any : [];
  if (requiredSourcesAny.length > 0) {
    const hits = requiredSourcesAny.filter((term) => normalizedIncludes(answerAndSources, term));
    checks.push({
      id: 'required_sources_any',
      pass: hits.length > 0,
      details: hits.length > 0 ? `hit=${hits.join(', ')}` : `missing_any=${requiredSourcesAny.join(', ')}`,
    });
  }

  const mustNotMention = Array.isArray(testCase.must_not_mention) ? testCase.must_not_mention : [];
  if (mustNotMention.length > 0) {
    const hits = mustNotMention.filter((term) => normalizedIncludes(answer, term));
    checks.push({
      id: 'must_not_mention',
      pass: hits.length === 0,
      details: hits.length === 0 ? 'none' : `forbidden=${hits.join(', ')}`,
    });
  }

  const minCitedSources = Number(testCase.min_cited_sources || 0);
  if (minCitedSources > 0) {
    checks.push({
      id: 'min_cited_sources',
      pass: Number(grounding.cited_source_count || 0) >= minCitedSources,
      details: `cited=${grounding.cited_source_count || 0} required=${minCitedSources}`,
    });
  }

  checks.push({
    id: 'unsupported_claims',
    pass: (grounding.unsupported_claims || []).length === 0,
    details: `unsupported=${(grounding.unsupported_claims || []).length}`,
  });

  checks.push({
    id: 'query_specificity',
    pass: grounding.query_specific !== false,
    details: `generic=${(grounding.generic_claims || []).length}`,
  });

  return {
    answer,
    grounding,
    checks,
    passed: checks.every((check) => check.pass),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const fixture = loadJson(options.fixture);
  let cases = Array.isArray(fixture?.cases) ? fixture.cases : Array.isArray(fixture) ? fixture : [];
  if (options.caseId) {
    cases = cases.filter((testCase) => testCase.id === options.caseId);
  }
  const entries = loadAllEntries();
  const entriesById = new Map(entries.map((entry) => [entry.id, entry]));
  const scenarios = loadLifeEventScenarios();
  const resourcePacks = loadLifeEventResourcePacks();
  const topicLinks = loadTopicLinks();

  if (cases.length === 0) {
    throw new Error(
      options.caseId
        ? `No answer-quality case "${options.caseId}" found in ${options.fixture}`
        : `No answer-quality cases found in ${options.fixture}`
    );
  }

  console.log(`Answer-quality suite: ${options.fixture}`);
  console.log(`Cases: ${cases.length}`);
  console.log(`Loaded entries: ${entries.length}`);
  console.log(`Synthesis: ${options.endpoint ? options.endpoint : 'local extractive baseline'}`);

  let passedCases = 0;
  let passedChecks = 0;
  let totalChecks = 0;

  for (const testCase of cases) {
    const topK = Math.max(1, Number(testCase.top_k || 8));
    const retrieval = localEvaluateEntries(entries, testCase.query, {
      lifeEventId: testCase.life_event || undefined,
      lifeEventScenarios: scenarios,
      lifeEventResourcePacks: resourcePacks,
      topicLinks,
    });
    const evidence = resultToEvidence(retrieval.results, entriesById, topK);
    const answerPayload = options.endpoint
      ? await synthesizeWithEndpoint(options.endpoint, testCase)
      : {
          answer: extractiveSynthesisAnswer(evidence),
          explanation: 'Local extractive baseline.',
          sources: evidence.map((item) => item.source),
          answer_quality: evaluateAnswerGrounding(extractiveSynthesisAnswer(evidence), evidence, testCase.query),
        };
    const result = checkCase(testCase, answerPayload, evidence);
    if (result.passed) passedCases += 1;
    passedChecks += result.checks.filter((check) => check.pass).length;
    totalChecks += result.checks.length;

    console.log('');
    console.log(`[${result.passed ? 'PASS' : 'FAIL'}] ${testCase.id}: ${testCase.query}`);
    console.log(`  stages: ${retrieval.stages.join(', ') || 'none'} | top: ${retrieval.results.slice(0, 3).map((item) => item.title).join(' | ') || 'none'}`);
    if ((retrieval.topic_links || []).length > 0) {
      console.log(`  topic links: ${(retrieval.topic_links || []).join(', ')}`);
    }
    for (const check of result.checks) {
      console.log(`  - ${check.pass ? 'ok' : 'x'} ${check.id}: ${check.details}`);
    }
    if ((result.grounding.unsupported_claims || []).length > 0) {
      const first = result.grounding.unsupported_claims[0];
      console.log(`  first unsupported: ${first.claim}`);
    }
    if (options.showAnswer) {
      console.log('  answer:');
      console.log(result.answer.split('\n').map((line) => `    ${line}`).join('\n'));
    }
  }

  const casePassRate = (passedCases / cases.length) * 100;
  const checkPassRate = totalChecks > 0 ? (passedChecks / totalChecks) * 100 : 100;
  console.log('');
  console.log('Summary:');
  console.log(`  case_pass: ${passedCases}/${cases.length} (${casePassRate.toFixed(1)}%)`);
  console.log(`  check_pass: ${passedChecks}/${totalChecks} (${checkPassRate.toFixed(1)}%)`);

  if (passedCases !== cases.length && options.failOnRegression) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
