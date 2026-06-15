import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_ASSISTANT_RESPONSES,
  countAssistantResponses,
  onRequest,
} from '../cloudflare-pages/functions/api/ai/chat.js';

function installCacheMock() {
  const store = new Map();
  globalThis.caches = {
    default: {
      async match(request) {
        return store.get(request.url)?.clone() || undefined;
      },
      async put(request, response) {
        store.set(request.url, response.clone());
      },
    },
  };
}

test('counts only assistant role messages for the demo chat limit', () => {
  assert.equal(
    countAssistantResponses([
      { role: 'user', content: 'eins' },
      { role: 'assistant', content: 'antwort eins' },
      { role: 'user', content: 'zwei' },
      { role: 'assistant', content: 'antwort zwei' },
    ]),
    2
  );
});

test('chat API rejects the fourth assistant response in one demo chat', async () => {
  installCacheMock();

  const messages = [
    { role: 'user', content: 'Frage 1' },
    { role: 'assistant', content: 'Antwort 1' },
    { role: 'user', content: 'Frage 2' },
    { role: 'assistant', content: 'Antwort 2' },
    { role: 'user', content: 'Frage 3' },
    { role: 'assistant', content: 'Antwort 3' },
    { role: 'user', content: 'Frage 4' },
  ];

  assert.equal(countAssistantResponses(messages), MAX_ASSISTANT_RESPONSES);

  const response = await onRequest({
    request: new Request('http://localhost/api/ai/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages }),
    }),
    env: {},
  });
  const payload = await response.json();

  assert.equal(response.status, 429);
  assert.match(payload.error, /drei Antworten begrenzt/);
});
