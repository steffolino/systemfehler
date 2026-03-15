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
