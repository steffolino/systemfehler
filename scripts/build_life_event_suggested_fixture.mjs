#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const SUGGESTIONS_FILE = path.join(repoRoot, 'frontend', 'src', 'data', 'life_event_suggested_questions.json');
const LIFE_EVENTS_FILE = path.join(repoRoot, 'data', '_topics', 'life_events.json');
const OUTPUT_FILE = path.join(repoRoot, 'tests', 'fixtures', 'life_event_suggested_queries.json');

function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function main() {
  const suggestions = loadJson(SUGGESTIONS_FILE);
  const lifeEvents = loadJson(LIFE_EVENTS_FILE);
  const scenarios = Array.isArray(lifeEvents?.scenarios) ? lifeEvents.scenarios : [];
  const scenarioById = new Map(scenarios.map((scenario) => [scenario.id, scenario]));

  const queries = [];

  for (const [scenarioId, list] of Object.entries(suggestions)) {
    const scenario = scenarioById.get(scenarioId);
    if (!scenario) continue;
    const requiredDomainsAny = Array.isArray(scenario.domains)
      ? scenario.domains.slice(0, 2)
      : [];
    const relevanceGuard = scenario.relevance_guard && typeof scenario.relevance_guard === 'object'
      ? scenario.relevance_guard
      : {};
    const requiredTermsAny = Array.isArray(relevanceGuard.required_any) && relevanceGuard.required_any.length > 0
      ? relevanceGuard.required_any.slice(0, 6)
      : Array.isArray(scenario.expansions)
        ? scenario.expansions.slice(0, 6)
        : [];
    const blockedTermsAny = Array.isArray(relevanceGuard.blocked_any)
      ? relevanceGuard.blocked_any.slice(0, 6)
      : [];

    const questions = Array.isArray(list)
      ? list.filter((q) => typeof q === 'string' && q.trim())
      : [];

    questions.forEach((question, index) => {
      queries.push({
        id: `suggested-${scenarioId}-${String(index + 1).padStart(2, '0')}`,
        query: question,
        expected_life_event: scenarioId,
        required_domains_any: requiredDomainsAny,
        expected_terms_any: requiredTermsAny,
        blocked_terms_any: blockedTermsAny,
        top_k: 8,
      });
    });
  }

  const payload = {
    version: '1.0.0',
    generated_at: new Date().toISOString(),
    source: {
      suggestions_file: path.relative(repoRoot, SUGGESTIONS_FILE).replace(/\\/g, '/'),
      life_events_file: path.relative(repoRoot, LIFE_EVENTS_FILE).replace(/\\/g, '/'),
    },
    query_count: queries.length,
    queries,
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(payload, null, 2));
  console.log(`Wrote ${path.relative(repoRoot, OUTPUT_FILE)} with ${queries.length} queries.`);
}

main();
