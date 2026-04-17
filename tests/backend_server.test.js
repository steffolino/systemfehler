import test from 'node:test';
import assert from 'node:assert/strict';

import { createApp } from '../backend/server.js';

async function withServer(handler, options = {}) {
  const logger = { log() {}, error() {} };
  const app = createApp({
    dbModule: options.dbModule || {
      async query() {
        return { rows: [{ now: new Date().toISOString() }] };
      },
      async closePool() {},
    },
    queriesModule: options.queriesModule || {},
    logger,
  });

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await handler(baseUrl);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test('health endpoint reports database connectivity', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.status, 'ok');
    assert.equal(payload.database, 'connected');
  });
});

test('health endpoint reports database disconnection', async () => {
  await withServer(
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/health`);
      assert.equal(response.status, 503);
      const payload = await response.json();
      assert.equal(payload.status, 'error');
      assert.equal(payload.database, 'disconnected');
      assert.match(payload.error, /db offline/);
    },
    {
      dbModule: {
        async query() {
          throw new Error('db offline');
        },
        async closePool() {},
      },
    }
  );
});

test('version endpoint returns service metadata', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/version`);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.service, 'systemfehler-api');
    assert.equal(payload.runtime, 'node-express');
    assert.equal(payload.host.includes('127.0.0.1'), true);
  });
});

test('entries endpoint forwards search requests to autocomplete query', async () => {
  const calls = [];
  await withServer(
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/data/entries?search=buergergeld&limit=12`);
      assert.equal(response.status, 200);
      const payload = await response.json();
      assert.equal(payload.total, 1);
      assert.equal(payload.entries[0].id, 'entry-1');
    },
    {
      queriesModule: {
        async searchEntriesForAutocomplete(options) {
          calls.push(['searchEntriesForAutocomplete', options]);
          return { entries: [{ id: 'entry-1' }], total: 1, limit: 12, offset: 0 };
        },
        async getAllEntries() {
          throw new Error('should not be called');
        },
      },
    }
  );

  assert.equal(calls[0][0], 'searchEntriesForAutocomplete');
  assert.equal(calls[0][1].searchText, 'buergergeld');
  assert.equal(calls[0][1].limit, 12);
});

test('entries endpoint forwards non-search requests to getAllEntries', async () => {
  const calls = [];
  await withServer(
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/data/entries?domain=aid&status=active&limit=7&offset=14&includeTranslations=true`);
      assert.equal(response.status, 200);
      const payload = await response.json();
      assert.equal(payload.total, 2);
      assert.equal(payload.entries[1].id, 'entry-2');
    },
    {
      queriesModule: {
        async searchEntriesForAutocomplete() {
          throw new Error('should not be called');
        },
        async getAllEntries(options) {
          calls.push(options);
          return { entries: [{ id: 'entry-1' }, { id: 'entry-2' }], total: 2, limit: 7, offset: 14 };
        },
      },
    }
  );

  assert.deepEqual(calls[0], {
    domain: 'aid',
    status: 'active',
    sourceTier: undefined,
    jurisdiction: undefined,
    limit: 7,
    offset: 14,
    includeTranslations: true,
  });
});

test('entries endpoint returns 500 on query failure', async () => {
  await withServer(
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/data/entries`);
      assert.equal(response.status, 500);
      const payload = await response.json();
      assert.equal(payload.error, 'Failed to fetch entries');
    },
    {
      queriesModule: {
        async getAllEntries() {
          throw new Error('boom');
        },
      },
    }
  );
});

test('entry detail endpoint returns 404 for missing entry', async () => {
  await withServer(
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/data/entries/missing`);
      assert.equal(response.status, 404);
      const payload = await response.json();
      assert.equal(payload.error, 'Entry not found');
    },
    {
      queriesModule: {
        async getEntryById() {
          return null;
        },
      },
    }
  );
});

test('moderation queue falls back to file when DB queue is empty', async () => {
  await withServer(
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/data/moderation-queue`);
      assert.equal(response.status, 200);
      const payload = await response.json();
      assert.equal(Array.isArray(payload.queue), true);
      assert.equal(payload.total, payload.queue.length);
      if (payload.queue.length > 0) {
        assert.equal(payload.queue[0].status, 'pending');
      }
    },
    {
      queriesModule: {
        async getModerationQueue() {
          return [];
        },
      },
    }
  );
});

test('quality report endpoint transforms query payload', async () => {
  await withServer(
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/data/quality-report`);
      assert.equal(response.status, 200);
      const payload = await response.json();
      assert.equal(payload.byDomain.benefits.totalEntries, 3);
      assert.equal(payload.lowQualityEntries[0].title, 'Low quality');
      assert.equal(payload.missingTranslations[0].missingEn, true);
    },
    {
      queriesModule: {
        async getQualityReport() {
          return {
            byDomain: [
              {
                domain: 'benefits',
                total_entries: '3',
                active_entries: '2',
                avg_iqs: '77.1',
                avg_ais: '74.6',
                missing_en_translation: '1',
                missing_easy_de_translation: '2',
              },
            ],
            lowQualityEntries: [
              { id: 'entry-1', domain: 'benefits', title_de: 'Low quality', url: 'https://example.org', iqs: '42.2', ais: '41.3' },
            ],
            missingTranslations: [
              { id: 'entry-2', domain: 'aid', title_de: 'Missing', url: 'https://example.org/2', missing_en: true, missing_easy_de: false },
            ],
          };
        },
      },
    }
  );
});

test('quality report endpoint returns 500 on query failure', async () => {
  await withServer(
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/data/quality-report`);
      assert.equal(response.status, 500);
      const payload = await response.json();
      assert.equal(payload.error, 'Failed to fetch quality report');
    },
    {
      queriesModule: {
        async getQualityReport() {
          throw new Error('report failed');
        },
      },
    }
  );
});

test('status endpoint transforms grouped statistics', async () => {
  await withServer(
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/status`);
      assert.equal(response.status, 200);
      const payload = await response.json();
      assert.equal(payload.database.totalEntries, 5);
      assert.equal(payload.database.byDomain.benefits.active, 3);
      assert.equal(payload.moderation.pending, 2);
      assert.equal(payload.qualityScores.avgIqs, '82.50');
    },
    {
      queriesModule: {
        async getStatistics() {
          return {
            entries: [
              { domain: 'benefits', status: 'active', count: '3' },
              { domain: 'tools', status: 'active', count: '2' },
            ],
            moderation: [{ status: 'pending', count: '2' }],
            qualityScores: { avg_iqs: '82.5', avg_ais: '77.25' },
          };
        },
      },
    }
  );
});

test('unknown routes return JSON 404', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/does-not-exist`);
    assert.equal(response.status, 404);
    const payload = await response.json();
    assert.equal(payload.error, 'Not found');
  });
});
