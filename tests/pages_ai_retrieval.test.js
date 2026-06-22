import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSynthesis,
  getLlmModel,
  getLlmModelConfig,
  getLlmProvider,
  getWorkersAiModel,
  getWorkersAiModelConfig,
  localEvaluateEntries,
  retrieveEvidence,
  runLlmText,
} from '../cloudflare-pages/functions/api/_lib/ai.js';

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

test('Workers AI model config supports task-specific overrides without changing defaults', () => {
  assert.equal(getWorkersAiModel({}, 'synthesize'), '@cf/meta/llama-3.1-8b-instruct');
  assert.equal(getWorkersAiModel({ CF_AI_MODEL: '@cf/base/model' }, 'rewrite'), '@cf/base/model');
  assert.equal(
    getWorkersAiModel({
      CF_AI_MODEL: '@cf/base/model',
      CF_AI_MODEL_PLAIN_LANGUAGE: '@cf/plain/model',
    }, 'plain_language'),
    '@cf/plain/model'
  );

  const config = getWorkersAiModelConfig({
    AI: {},
    CF_AI_MODEL: '@cf/base/model',
    CF_AI_MODEL_REWRITE: '@cf/rewrite/model',
  });
  assert.equal(config.provider, 'workers-ai');
  assert.equal(config.defaultModel, '@cf/base/model');
  assert.equal(config.tasks.rewrite.model, '@cf/rewrite/model');
  assert.equal(config.tasks.synthesize.model, '@cf/base/model');
});

test('LLM model config supports Mistral and task-specific overrides', () => {
  const env = {
    LLM_PROVIDER: 'mistral',
    MISTRAL_API_KEY: 'test-key',
    MISTRAL_MODEL: 'mistral-small-latest',
    LLM_MODEL_PLAIN_LANGUAGE: 'custom-simple-model',
  };

  assert.equal(getLlmProvider(env), 'mistral');
  assert.equal(getLlmModel(env, 'synthesize'), 'mistral-small-latest');
  assert.equal(getLlmModel(env, 'plain_language'), 'custom-simple-model');

  const config = getLlmModelConfig(env);
  assert.equal(config.provider, 'mistral');
  assert.equal(config.configured, true);
  assert.equal(config.defaultModel, 'mistral-small-latest');
  assert.equal(config.tasks.plain_language.model, 'custom-simple-model');
});

test('runLlmText calls Mistral chat completions without Workers AI binding', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: 'Antwort in Einfacher Sprache.',
            },
          },
        ],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  };

  try {
    const result = await runLlmText(
      {
        LLM_PROVIDER: 'mistral',
        MISTRAL_API_KEY: 'test-key',
        MISTRAL_MODEL_PLAIN_LANGUAGE: 'mistral-small-latest',
      },
      {
        systemPrompt: 'System',
        userPrompt: 'User',
        maxTokens: 42,
        task: 'plain_language',
      }
    );

    assert.equal(result.text, 'Antwort in Einfacher Sprache.');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://api.mistral.ai/v1/chat/completions');
    assert.equal(calls[0].init.headers.Authorization, 'Bearer test-key');
    const body = JSON.parse(calls[0].init.body);
    assert.equal(body.model, 'mistral-small-latest');
    assert.equal(body.max_tokens, 42);
    assert.deepEqual(body.messages.map((message) => message.role), ['system', 'user']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

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

test('family application retrieval keeps self-employment context out of top results', () => {
  const entries = loadEntries();
  const scenarios = loadJson('data/_topics/life_events.json').scenarios;
  const packs = loadJson('data/_topics/life_event_resource_packs.json');
  const topics = loadJson('data/_topics/topic_links.json');
  const result = localEvaluateEntries(
    entries,
    'Wo kann ich Kindergeld und Kinderzuschlag beantragen?',
    {
      lifeEventScenarios: scenarios,
      lifeEventResourcePacks: packs,
      topicLinks: topics,
    }
  );

  const topTitles = result.results.slice(0, 5).map((item) => item.title);
  assert.ok(topTitles.some((title) => /Kindergeld-Antrag/i.test(title)));
  assert.ok(topTitles.some((title) => /Kinderzuschlag/i.test(title)));
  assert.ok(!topTitles.some((title) => /Selbstst/i.test(title)));
});

test('family amount retrieval keeps self-employment context out of top results', () => {
  const entries = loadEntries();
  const scenarios = loadJson('data/_topics/life_events.json').scenarios;
  const packs = loadJson('data/_topics/life_event_resource_packs.json');
  const topics = loadJson('data/_topics/topic_links.json');
  const result = localEvaluateEntries(
    entries,
    'Wie viel Kindergeld und Kinderzuschlag bekomme ich?',
    {
      lifeEventScenarios: scenarios,
      lifeEventResourcePacks: packs,
      topicLinks: topics,
    }
  );

  const topTitles = result.results.slice(0, 5).map((item) => item.title);
  assert.ok(topTitles.some((title) => /Kinderzuschlag: Anspruch/i.test(title)));
  assert.ok(!topTitles.some((title) => /Selbstst/i.test(title)));
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

test('synthesis guards generated answers that miss application-place intent', async () => {
  const evidence = [
    {
      source: 'https://www.arbeitsagentur.de/arbeitslos-arbeit-finden/buergergeld/buergergeld-beantragen',
      confidence: 0.92,
      content: JSON.stringify({
        title: 'Buergergeld online beantragen',
        url: 'https://www.arbeitsagentur.de/arbeitslos-arbeit-finden/buergergeld/buergergeld-beantragen',
        domain: 'benefits',
        summary: {
          de: 'Buergergeld koennen Sie online beim Jobcenter beantragen.',
        },
        provenance: {
          sourceTier: 'tier_1_official',
          sourceRole: 'official_info',
        },
      }),
    },
  ];
  const env = {
    AI: {
      async run() {
        return {
          response: '- Einkommen mit Buergergeld ergaenzen, wenn der Lohn nicht reicht.',
        };
      },
    },
  };

  const response = await buildSynthesis(
    env,
    'Wo kann ich Buergergeld beantragen?',
    evidence,
    { retrieval_mode: 'keyword' },
    { official: evidence, assistive: [], contacts: [], context: [] }
  );

  assert.equal(response.fallback, true);
  assert.equal(response.answer_guard.passed, false);
  assert.ok(response.answer_guard.findings.includes('missing_place_answer'));
  assert.match(response.answer, /Antrag starten/i);
  assert.match(response.answer, /Buergergeld online beantragen/i);
  assert.match(response.answer, /\[Quelle: https:\/\/www\.arbeitsagentur\.de\/arbeitslos-arbeit-finden\/buergergeld\/buergergeld-beantragen\]/);
  assert.equal(response.answer_quality.answer_shape.passed, true);
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
