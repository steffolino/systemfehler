import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { __private } from '../backend/database/queries.js';

test('buildMultilingual only returns populated locales', () => {
  assert.deepEqual(
    __private.buildMultilingual({ de: 'Hallo', en: '', easyDe: 'Leicht' }),
    { de: 'Hallo', easy_de: 'Leicht' }
  );
  assert.equal(__private.buildMultilingual({ de: '', en: '', easyDe: '' }), undefined);
});

test('mapEntryRow normalizes row shape and back-compat keys', () => {
  const row = {
    id: 'entry-1',
    domain: 'benefits',
    title_de: 'Buergergeld',
    summary_de: 'Kurzinfo',
    content_de: 'Langer Text',
    url: 'https://example.org',
    topics: ['employment'],
    tags: ['application_required'],
    target_groups: ['unemployed'],
    status: 'active',
    valid_from: '2026-01-01',
    first_seen: '2026-01-01T00:00:00.000Z',
    last_seen: '2026-02-01T00:00:00.000Z',
    source_unavailable: false,
    provenance: { source: 'Example Source' },
    quality_scores: { iqs: 81.2, ais: 77.7 },
    iqs: 81.2,
    ais: 77.7,
    created_at: '2026-01-02T00:00:00.000Z',
    updated_at: '2026-02-02T00:00:00.000Z',
  };

  const result = __private.mapEntryRow(row);

  assert.equal(result.title, 'Buergergeld');
  assert.deepEqual(result.summary, { de: 'Kurzinfo' });
  assert.deepEqual(result.content, { de: 'Langer Text' });
  assert.deepEqual(result.targetGroups, ['unemployed']);
  assert.deepEqual(result.target_groups, ['unemployed']);
  assert.equal(result.firstSeen, '2026-01-01T00:00:00.000Z');
  assert.equal(result.last_seen, '2026-02-01T00:00:00.000Z');
  assert.equal(result.iqs, 81.2);
  assert.equal(result.qualityScores.ais, 77.7);
});

test('buildPagination derives page and page count', () => {
  assert.deepEqual(__private.buildPagination(101, 25, 50), {
    total: 101,
    limit: 25,
    offset: 50,
    page: 3,
    pages: 5,
  });
});

test('getLanguageColumns switches between German and English columns', () => {
  assert.deepEqual(__private.getLanguageColumns('german'), {
    titleCol: 'title_de',
    summaryCol: 'summary_de',
    contentCol: 'content_de',
  });
  assert.deepEqual(__private.getLanguageColumns('english'), {
    titleCol: 'title_en',
    summaryCol: 'summary_en',
    contentCol: 'content_en',
  });
});

test('loadTranslationsForDomains picks up translations from snapshot files', async () => {
  const tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), 'systemfehler-translations-'));
  const originalCwd = process.cwd();

  try {
    const dataDir = path.join(tmpdir, 'data', 'benefits');
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(
      path.join(dataDir, 'entries.json'),
      JSON.stringify({
        entries: [
          {
            id: 'entry-1',
            translations: {
              en: { title: 'Benefit', provenance: { source: 'test', crawledAt: '2026-01-01' }, timestamp: '2026-01-01' },
            },
          },
        ],
      }),
      'utf8'
    );

    process.chdir(tmpdir);
    const result = await __private.loadTranslationsForDomains(['benefits']);
    assert.deepEqual(Object.keys(result), ['entry-1']);
    assert.equal(result['entry-1'].en.title, 'Benefit');
  } finally {
    process.chdir(originalCwd);
    await fs.rm(tmpdir, { recursive: true, force: true });
  }
});
