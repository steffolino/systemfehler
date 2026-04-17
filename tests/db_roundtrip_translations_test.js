import assert from 'assert';

process.env.SYSTEMFEHLER_SKIP_DB_PING = '1';

const { __private } = await import('../backend/database/queries.js');

const now = new Date().toISOString();
const translations = {
  'de-EINFACH-SUGGESTED': {
    title: 'Klarer Titel',
    summary: 'Kurze klare Zusammenfassung',
    body: 'Klarer Text',
    provenance: {
      source: 'example.org',
      crawledAt: now,
      method: 'rule',
      generator: 'systemfehler-plain-language-v1'
    },
    method: 'rule',
    generator: 'systemfehler-plain-language-v1',
    timestamp: now,
    reviewed: false,
    variant: 'einfach',
    reviewStatus: 'suggested'
  },
  'de-LEICHT': {
    title: 'Einfacher Titel',
    summary: 'Kurze einfache Zusammenfassung',
    body: 'Einfacher Text',
    provenance: {
      source: 'example.org',
      crawledAt: now,
      method: 'llm',
      generator: 'test-model'
    },
    method: 'llm',
    generator: 'test-model',
    timestamp: now,
    reviewed: false,
    variant: 'leicht',
    reviewStatus: 'approved',
    reviewedBy: 'admin@example.org',
    reviewedAt: now
  }
};

const row = {
  id: '11111111-1111-4111-8111-111111111111',
  domain: 'benefits',
  title_de: 'Titel',
  title_en: 'Title',
  title_easy_de: null,
  summary_de: 'Zusammenfassung',
  summary_en: 'Summary',
  summary_easy_de: null,
  content_de: 'Inhalt',
  content_en: 'Content',
  content_easy_de: null,
  url: 'https://example.org/service',
  topics: ['housing'],
  tags: ['pilot'],
  target_groups: ['families'],
  status: 'active',
  valid_from: null,
  valid_until: null,
  deadline: null,
  first_seen: now,
  last_seen: now,
  source_unavailable: false,
  provenance: {
    source: 'example.org',
    crawledAt: now,
    crawlId: 'crawl-1'
  },
  translations,
  quality_scores: {
    iqs: 80,
    ais: 70,
    computedAt: now
  },
  iqs: 80,
  ais: 70,
  created_at: now,
  updated_at: now
};

const mapped = __private.mapEntryRow(row, { includeTranslations: true });

assert.deepStrictEqual(mapped.translations, translations, 'Expected translations to be exported from mapped row');
assert.deepStrictEqual(mapped.translationLanguages, ['de-EINFACH-SUGGESTED', 'de-LEICHT'], 'Expected translation language list');
assert.deepStrictEqual(mapped.provenance, row.provenance, 'Expected provenance to be exported from mapped row');
assert.strictEqual(mapped.title, 'Titel', 'Expected title mapping to remain intact');
assert.strictEqual(mapped.translations['de-EINFACH-SUGGESTED'].variant, 'einfach', 'Expected variant metadata');
assert.strictEqual(mapped.translations['de-LEICHT'].reviewStatus, 'approved', 'Expected review status metadata');

console.log('✓ DB ingestion/export mapping roundtrip test passed');
