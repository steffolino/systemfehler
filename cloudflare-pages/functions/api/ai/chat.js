import {
  buildSynthesis,
  enforceRateLimit,
  getRetrievalConfig,
  getWorkersAiModel,
  normalizeQuery,
  retrieveEvidence,
  runWorkersAiText,
  verifyTurnstile,
} from '../_lib/ai.js';
import { jsonResponse, optionsResponse } from '../_lib/http.js';

const MAX_CHAT_MESSAGES = 8;
const MAX_MESSAGE_CHARS = 1200;
export const MAX_ASSISTANT_RESPONSES = 3;

function normalizeMessages(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((message) => ({
      role: message?.role === 'assistant' ? 'assistant' : 'user',
      content: String(message?.content || '').trim().slice(0, MAX_MESSAGE_CHARS),
    }))
    .filter((message) => message.content)
    .slice(-MAX_CHAT_MESSAGES);
}

function latestUserMessage(messages) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === 'user') return messages[index].content;
  }
  return '';
}

export function countAssistantResponses(messages) {
  return messages.filter((message) => message.role === 'assistant').length;
}

function compactConversation(messages) {
  return messages
    .map((message) => `${message.role === 'assistant' ? 'Assistant' : 'User'}: ${message.content}`)
    .join('\n');
}

async function buildStandaloneQuery(env, messages) {
  const latest = latestUserMessage(messages);
  if (!latest) return '';
  if (messages.length <= 1 || !env.AI) return latest;

  try {
    const completion = await runWorkersAiText(env, {
      systemPrompt:
        'Du formulierst Chat-Verlauf in eine eigenstaendige Suchfrage fuer ein deutsches Sozialleistungs-Retrieval-System um. ' +
        'Erhalte Fakten aus dem Verlauf, erfinde nichts dazu, und gib nur die Suchfrage auf Deutsch zurueck.',
      userPrompt:
        `Chat-Verlauf:\n${compactConversation(messages)}\n\n` +
        'Gib eine kurze, eigenstaendige Suchfrage zur letzten Nutzerfrage zurueck.',
      maxTokens: 80,
    });
    return normalizeQuery(completion.text || latest) || latest;
  } catch (error) {
    console.error('chat standalone query failed:', error);
    return latest;
  }
}

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') {
    return optionsResponse(request, env, { methods: 'POST, OPTIONS', headers: 'Content-Type, x-turnstile-token' });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405, request, env, cors: true });
  }

  const rateLimit = await enforceRateLimit(request, env, 'chat');
  if (!rateLimit.allowed) {
    return jsonResponse({ error: 'Too many AI requests. Please wait a moment.' }, {
      status: 429,
      request,
      env,
      cors: true,
      headers: rateLimit.headers,
    });
  }

  const turnstile = await verifyTurnstile(request, env);
  if (!turnstile.success) {
    return jsonResponse(
      { error: turnstile.error || 'Turnstile verification failed.' },
      { status: 403, request, env, cors: true }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, { status: 400, request, env, cors: true });
  }

  const messages = normalizeMessages(body?.messages);
  const latest = latestUserMessage(messages);
  if (!latest) {
    return jsonResponse({ error: 'At least one user message is required.' }, { status: 400, request, env, cors: true });
  }

  if (countAssistantResponses(messages) >= MAX_ASSISTANT_RESPONSES) {
    return jsonResponse(
      { error: 'Dieser Demo-Chat ist auf drei Antworten begrenzt. Starte einen neuen Chat, wenn du eine neue Frage prüfen möchtest.' },
      { status: 429, request, env, cors: true, headers: rateLimit.headers }
    );
  }

  const retrievalMode = typeof body?.retrieval_mode === 'string' ? body.retrieval_mode : undefined;
  const strictOfficial = typeof body?.strict_official === 'boolean' ? body.strict_official : undefined;
  const lifeEvent = typeof body?.life_event === 'string' ? body.life_event : undefined;
  const minSourceTier = typeof body?.min_source_tier === 'string' ? body.min_source_tier : undefined;
  const minConfidence =
    typeof body?.min_confidence === 'number' && Number.isFinite(body.min_confidence)
      ? body.min_confidence
      : undefined;
  const retrievalConfig = getRetrievalConfig(env, {
    retrievalMode,
    strictOfficial,
    lifeEventId: lifeEvent,
    minSourceTier,
    minConfidence,
  });
  const startedAt = Date.now();
  const standaloneQuery = await buildStandaloneQuery(env, messages);
  let evidence = [];
  let lanes = { official: [], assistive: [], contacts: [], context: [] };
  let diagnostics = {
    requested_mode: retrievalConfig.requestedMode,
    retrieval_mode: retrievalConfig.activeMode,
    strict_official: retrievalConfig.strictOfficial,
    min_source_tier: retrievalConfig.minSourceTier,
    min_confidence: retrievalConfig.minConfidence,
    external_configured: retrievalConfig.external.configured,
    external_status: 'error',
    evidence_before_filter: 0,
    evidence_after_filter: 0,
    dropped_by_policy: 0,
    fallback: true,
    detected_stages: [],
    selected_life_event: lifeEvent || null,
  };

  try {
    const retrieved = await retrieveEvidence(env, standaloneQuery, {
      retrievalMode,
      strictOfficial,
      lifeEventId: lifeEvent,
      minSourceTier,
      minConfidence,
      requestUrl: request.url,
    });
    evidence = Array.isArray(retrieved?.evidence) ? retrieved.evidence : [];
    lanes = retrieved?.lanes || lanes;
    diagnostics = retrieved?.diagnostics || diagnostics;
  } catch (error) {
    console.error('retrieveEvidence failed during chat:', error);
  }

  let response;
  try {
    response = await buildSynthesis(env, standaloneQuery, evidence, diagnostics, lanes);
  } catch (error) {
    console.error('buildSynthesis failed during chat:', error);
    response = {
      answer: null,
      explanation: 'Die Chat-Antwort ist gerade nicht verfuegbar. Bitte versuche es erneut.',
      sources: [],
      provider: env.AI ? 'workers-ai' : 'none',
      model: env.AI ? getWorkersAiModel(env) : 'fallback',
      fallback: true,
      evidence,
      evidence_lanes: lanes,
      weak_evidence: true,
      retrieval: diagnostics,
    };
  }

  return jsonResponse({
    ...response,
    standalone_query: standaloneQuery,
    latency_ms: Date.now() - startedAt,
  }, {
    request,
    env,
    cors: true,
    headers: rateLimit.headers,
  });
}
