import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

import { localEvaluateEntries, retrieveEvidence } from '../cloudflare-pages/functions/api/_lib/ai.js';

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
