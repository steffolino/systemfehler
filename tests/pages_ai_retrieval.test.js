import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSynthesis, localEvaluateEntries, retrieveEvidence } from '../cloudflare-pages/functions/api/_lib/ai.js';

const DOMAINS = ['benefits', 'aid', 'tools', 'organizations', 'contacts'];

function loadJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function loadEntries() {
  const entries = [];
  for (const domain of DOMAINS) {
    const path = `data/${domain}/entries.json`;
    if (!fs.existsSync(path)) continue;
    const raw = loadJson(path);
    const list = Array.isArray(raw) ? raw : Array.isArray(raw?.entries) ? raw.entries : [];
    for (const entry of list) {
      entries.push({
        ...entry,
        domain,
        status: String(entry.status || 'active').toLowerCase(),
      });
    }
  }
  return entries;
}

test('caregiving rewrite with compound umlauts resolves to strong care evidence', () => {
  const entries = loadEntries();
  const scenarios = loadJson('data/_topics/life_events.json').scenarios;
  const packs = loadJson('data/_topics/life_event_resource_packs.json');
  const result = localEvaluateEntries(
    entries,
    'pflegeangeh\u00f6rige \u00fcbernehmen welche sozialleistungen',
    {
      lifeEventScenarios: scenarios,
      lifeEventResourcePacks: packs,
    }
  );

  assert.deepEqual(result.stages, ['caregiving_relatives']);
  assert.ok(result.results.length >= 3);
  assert.ok(result.results.some((item) => item.domain === 'benefits' && /pflegegrad|pflegegeld/i.test(item.title)));
  assert.ok(result.results.some((item) => item.domain === 'contacts' && /pflegeberatung|pflegest/i.test(item.title)));
});

test('compound single-parent and illness query keeps health evidence near the top', () => {
  const entries = loadEntries();
  const scenarios = loadJson('data/_topics/life_events.json').scenarios;
  const packs = loadJson('data/_topics/life_event_resource_packs.json');
  const result = localEvaluateEntries(
    entries,
    'Ich bin alleinerziehend geworden und krank. wo bekomme ich hilfe?',
    {
      lifeEventScenarios: scenarios,
      lifeEventResourcePacks: packs,
    }
  );

  assert.ok(result.stages.includes('single_parent_new'));
  assert.ok(result.stages.includes('health_disruption'));
  assert.ok(
    result.results
      .slice(0, 4)
      .some((item) => /krank|krankengeld|krankenkasse|gesundheit|arbeitsunfaehig/i.test(`${item.title} ${item.url}`))
  );
});

test('retrieval includes curated official care evidence when keyword DB search misses', async () => {
  const env = {
    DB: {
      prepare() {
        return {
          bind() {
            return {
              async all() {
                return { results: [] };
              },
            };
          },
        };
      },
    },
    ASSETS: {
      async fetch(request) {
        const url = new URL(request.url);
        const localPath = url.pathname.replace(/^\/+/, '');
        if (!fs.existsSync(localPath)) return new Response('not found', { status: 404 });
        return new Response(fs.readFileSync(localPath, 'utf8'), {
          headers: { 'content-type': 'application/json' },
        });
      },
    },
  };

  const result = await retrieveEvidence(
    env,
    'pflegeangeh\u00f6rige \u00fcbernehmen welche sozialleistungen',
    {
      requestUrl: 'https://systemfehler.pages.dev/',
      strictOfficial: true,
    }
  );

  assert.equal(result.diagnostics.selected_life_event, 'caregiving_relatives');
  assert.ok(result.evidence.length >= 2);
  assert.ok(result.evidence.some((item) => item.source.includes('bundesgesundheitsministerium.de')));
  assert.ok(result.evidence.some((item) => item.source.includes('pflegelotse.de')));
});

test('synthesis routes local institution questions to official finders when exact data is unavailable', async () => {
  const response = await buildSynthesis(
    {},
    'Wo finde ich eine Arbeitsagentur in meiner Stadt?',
    [],
    { retrieval_mode: 'keyword' },
    { official: [], assistive: [], contacts: [], context: [] }
  );

  assert.equal(response.fallback, true);
  assert.equal(response.weak_evidence, true);
  assert.match(response.answer, /keinen verlässlichen lokalen Treffer/i);
  assert.match(response.answer, /Bundesagentur für Arbeit/i);
  assert.ok(response.sources.includes('https://web.arbeitsagentur.de/portal/metasuche/suche/dienststellen'));
  assert.deepEqual(response.retrieval.fallback_router, ['arbeitsagentur']);
});

test('synthesis routes weak health questions to a matching official institution source', async () => {
  const response = await buildSynthesis(
    {},
    'Welche Stelle hilft bei Krankengeld?',
    [],
    { retrieval_mode: 'keyword' },
    { official: [], assistive: [], contacts: [], context: [] }
  );

  assert.equal(response.fallback, true);
  assert.match(response.answer, /keinen ausreichend passenden Eintrag/i);
  assert.match(response.answer, /Bundesgesundheitsministerium: Krankengeld/i);
  assert.ok(response.sources.includes('https://www.bundesgesundheitsministerium.de/krankengeld'));
});

test('synthesis provides simple-language fallback without Workers AI', async () => {
  const evidence = [
    {
      source: 'https://www.arbeitsagentur.de/arbeitslos-arbeit-finden/buergergeld/buergergeld-beantragen',
      confidence: 0.9,
      content: JSON.stringify({
        title: 'Bürgergeld online beantragen',
        url: 'https://www.arbeitsagentur.de/arbeitslos-arbeit-finden/buergergeld/buergergeld-beantragen',
        domain: 'benefits',
        summary: {
          de: 'Bürgergeld können Sie online beim Jobcenter beantragen.',
        },
        provenance: {
          sourceTier: 'tier_1_official',
          sourceRole: 'official_info',
        },
      }),
    },
  ];

  const response = await buildSynthesis(
    {},
    'Wo kann ich Bürgergeld beantragen?',
    evidence,
    { retrieval_mode: 'keyword' },
    { official: evidence, assistive: [], contacts: [], context: [] }
  );

  assert.equal(response.provider, 'none');
  assert.ok(response.plain_language?.einfach);
  assert.equal(response.plain_language.sources.einfach, 'fallback');
  assert.match(response.plain_language.einfach, /Antrag/i);
  assert.match(response.plain_language.einfach, /\[Quelle: https:\/\/www\.arbeitsagentur\.de\/arbeitslos-arbeit-finden\/buergergeld\/buergergeld-beantragen\]/);
  assert.deepEqual(response.plain_language.quality.einfach.findings, []);
});

test('synthesis prioritizes local Sozialamt lookup over thematic benefit evidence', async () => {
  const evidence = [
    {
      source: 'https://www.deutsche-rentenversicherung.de/',
      confidence: 0.88,
      content: JSON.stringify({
        title: 'Grundsicherung bei Erwerbsminderung und Reha',
        url: 'https://www.deutsche-rentenversicherung.de/',
        domain: 'benefits',
        summary: { de: 'Thematischer Beleg, aber keine lokale Sozialamt-Adresse.' },
        provenance: {
          source: 'https://www.deutsche-rentenversicherung.de/',
          sourceTier: 'tier_2_official',
          sourceRole: 'official_info',
        },
      }),
    },
  ];

  const response = await buildSynthesis(
    {},
    'Und wo ist das Sozialamt in Leipzig?',
    evidence,
    { retrieval_mode: 'keyword' },
    { official: evidence, assistive: [], contacts: [], context: [] }
  );

  assert.equal(response.fallback, true);
  assert.match(response.answer, /keinen verlässlichen lokalen Treffer/i);
  assert.match(response.answer, /Stadt Leipzig/i);
  assert.ok(response.sources.includes('https://www.leipzig.de/'));
  assert.ok(response.retrieval.fallback_router.includes('stadt_leipzig_sozialamt'));
});
