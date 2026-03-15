const DEFAULT_MODEL = '@cf/meta/llama-3.1-8b-instruct';

function parseJsonSafe(value, fallback = {}) {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function getLocalizedString(value, fallback = '') {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value && typeof value === 'object') {
    if (typeof value.de === 'string' && value.de.trim()) return value.de.trim();
    if (typeof value.en === 'string' && value.en.trim()) return value.en.trim();
    if (typeof value.easy_de === 'string' && value.easy_de.trim()) return value.easy_de.trim();
  }
  return fallback;
}

function normalizeEntryRow(row) {
  const entry = parseJsonSafe(row?.entry_json, {});
  entry.id = row.id;
  entry.domain = row.domain;
  entry.url = row.url;
  entry.status = row.status;
  entry.title_de = row.title_de;
  entry.updated_at = row.updated_at;
  return entry;
}

function entryTextBlob(entry) {
  return [
    getLocalizedString(entry.title, entry.title_de || ''),
    getLocalizedString(entry.summary, entry.summary_de || ''),
    getLocalizedString(entry.content, entry.content_de || ''),
    entry.url || '',
    entry.domain || '',
    Array.isArray(entry.topics) ? entry.topics.join(' ') : '',
    Array.isArray(entry.tags) ? entry.tags.join(' ') : '',
    Array.isArray(entry.targetGroups) ? entry.targetGroups.join(' ') : '',
    Array.isArray(entry.target_groups) ? entry.target_groups.join(' ') : '',
  ]
    .join(' ')
    .toLowerCase();
}

function normalizedQueryTokens(query) {
  return (query || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function scoreEntry(query, entry) {
  const q = (query || '').toLowerCase();
  const text = entryTextBlob(entry);
  const title = getLocalizedString(entry.title, entry.title_de || '').toLowerCase();
  let score = 0;

  for (const token of normalizedQueryTokens(query)) {
    if (title.includes(token)) score += 3;
    if (text.includes(token)) score += 1.25;
  }

  if (q.includes('arbeitslos') || q.includes('job verloren') || q.includes('job weg')) {
    if (text.includes('buergergeld') || text.includes('bürgergeld')) score += 6;
    if (text.includes('arbeitslosengeld')) score += 6;
    if (text.includes('jobcenter')) score += 5;
    if (text.includes('arbeitsagentur')) score += 4;
    if (entry.domain === 'benefits') score += 4;
    if (entry.domain === 'contacts') score += 2;
    if (text.includes('kurzarbeitergeld')) score -= 4;
    if (text.includes('elterngeld')) score -= 5;
  }

  if (q.includes('kontakt') || q.includes('telefon') || q.includes('erreichen')) {
    if (entry.domain === 'contacts') score += 5;
  }

  if (q.includes('online') || q.includes('antrag') || q.includes('beantrag')) {
    if (entry.domain === 'tools') score += 4;
    if (text.includes('eservices')) score += 3;
  }

  return score;
}

function confidenceFromScore(score) {
  if (score >= 12) return 0.92;
  if (score >= 9) return 0.86;
  if (score >= 6) return 0.79;
  if (score >= 4) return 0.72;
  return 0.55;
}

export async function retrieveEvidence(env, query) {
  const db = env.DB;
  if (!db || !query?.trim()) return [];

  const needle = `%${query.trim()}%`;
  const rowsQuery =
    'SELECT id, domain, url, status, title_de, updated_at, entry_json FROM entries ' +
    'WHERE status = ? AND (LOWER(title_de) LIKE LOWER(?) OR LOWER(url) LIKE LOWER(?) OR LOWER(entry_json) LIKE LOWER(?)) ' +
    'ORDER BY updated_at DESC LIMIT 32';

  const result = await db.prepare(rowsQuery).bind('active', needle, needle, needle).all();
  const rows = Array.isArray(result?.results) ? result.results : [];
  return rows
    .map((row) => normalizeEntryRow(row))
    .map((entry) => ({ entry, score: scoreEntry(query, entry) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(({ entry, score }) => ({
      source: entry.url || 'unknown',
      content: JSON.stringify(entry),
      confidence: confidenceFromScore(score),
    }));
}

export function extractiveSynthesisAnswer(evidence) {
  const entries = evidence
    .slice(0, 3)
    .map((item) => parseJsonSafe(item.content, null))
    .filter(Boolean);

  if (entries.length === 0) return null;

  const primary = entries[0];
  const lines = [
    'Wahrscheinlich zuerst relevant:',
    `- ${getLocalizedString(primary.title, primary.title_de || 'Eintrag')}: ${getLocalizedString(primary.summary, primary.summary_de || 'Direkt pruefen.')}`,
  ];

  if (entries.length > 1) {
    lines.push('');
    lines.push('Was du jetzt tun kannst:');
    for (const entry of entries.slice(1)) {
      const title = getLocalizedString(entry.title, entry.title_de || 'Eintrag');
      if (entry.domain === 'tools') {
        lines.push(`- Online starten ueber ${title}.`);
      } else if (entry.domain === 'contacts') {
        lines.push(`- Kontakt aufnehmen ueber ${title}.`);
      } else {
        lines.push(`- Danach ${title} pruefen.`);
      }
    }
  }

  return lines.join('\n');
}

function compactEvidenceBlock(evidence) {
  return evidence
    .slice(0, 3)
    .map((item, index) => {
      const entry = parseJsonSafe(item.content, {});
      return [
        `Evidence ${index + 1}`,
        `Title: ${getLocalizedString(entry.title, entry.title_de || 'Unbekannt')}`,
        `Domain: ${entry.domain || 'unknown'}`,
        `URL: ${entry.url || 'unknown'}`,
        `Summary: ${getLocalizedString(entry.summary, entry.summary_de || 'Keine Kurzbeschreibung')}`,
      ].join('\n');
    })
    .join('\n\n');
}

export function getWorkersAiModel(env) {
  return env.CF_AI_MODEL || DEFAULT_MODEL;
}

function extractTextFromAiResponse(response) {
  if (!response || typeof response !== 'object') return '';
  if (typeof response.response === 'string') return response.response.trim();
  if (typeof response.result?.response === 'string') return response.result.response.trim();
  if (Array.isArray(response.result) && typeof response.result[0]?.response === 'string') {
    return response.result[0].response.trim();
  }
  return '';
}

export async function runWorkersAiText(env, { systemPrompt, userPrompt, maxTokens = 160 }) {
  if (!env.AI) {
    throw new Error('Workers AI binding is not configured.');
  }

  const response = await env.AI.run(getWorkersAiModel(env), {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: maxTokens,
  });

  return {
    text: extractTextFromAiResponse(response),
    raw: response,
  };
}

export async function verifyTurnstile(request, env) {
  const configured = Boolean(env.TURNSTILE_SECRET_KEY);
  if (!configured) {
    return { configured: false, success: true };
  }

  const token = request.headers.get('x-turnstile-token');
  if (!token) {
    return { configured: true, success: false, error: 'Missing Turnstile token.' };
  }

  const form = new URLSearchParams();
  form.set('secret', env.TURNSTILE_SECRET_KEY);
  form.set('response', token);

  const ip = request.headers.get('CF-Connecting-IP');
  if (ip) form.set('remoteip', ip);

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  const payload = await response.json();
  return {
    configured: true,
    success: Boolean(payload?.success),
    error: Array.isArray(payload?.['error-codes']) ? payload['error-codes'].join(', ') : null,
  };
}

export async function buildRewrite(env, query) {
  if (!query?.trim()) {
    return {
      rewritten_query: '',
      model: env.AI ? getWorkersAiModel(env) : 'disabled',
      provider: env.AI ? 'workers-ai' : 'none',
      latency_ms: 0,
      fallback: true,
      explanation: 'Enter a search query to use the AI assistant.',
    };
  }

  try {
    const completion = await runWorkersAiText(env, {
      systemPrompt:
        'You rewrite search queries for a German social-services retrieval system. Return only a short German rewrite that improves recall without adding facts.',
      userPrompt: `Original query:\n${query}\n\nReturn only the rewritten query.`,
      maxTokens: 32,
    });
    return {
      rewritten_query: completion.text || query,
      model: getWorkersAiModel(env),
      provider: 'workers-ai',
      latency_ms: 0,
      fallback: false,
    };
  } catch (error) {
    return {
      rewritten_query: query,
      model: env.AI ? getWorkersAiModel(env) : 'disabled',
      provider: env.AI ? 'workers-ai' : 'none',
      latency_ms: 0,
      fallback: true,
      explanation: error instanceof Error ? error.message : 'Workers AI request failed.',
    };
  }
}

export async function buildSynthesis(env, query, evidence) {
  const strongEvidence = evidence.filter((item) => item.confidence >= 0.7);
  if (strongEvidence.length === 0) {
    return {
      answer: null,
      explanation: 'Keine verlaessliche Information gefunden.',
      sources: [],
      provider: env.AI ? 'workers-ai' : 'none',
      model: env.AI ? getWorkersAiModel(env) : 'disabled',
      fallback: true,
      evidence,
      weak_evidence: true,
      usage: {},
    };
  }

  try {
    const completion = await runWorkersAiText(env, {
      systemPrompt:
        'You are a retrieval-first assistant for German social-service information. Use only the provided evidence. If evidence is weak, say so. Answer in concise German.',
      userPrompt:
        `User question:\n${query}\n\nRetrieved evidence:\n${compactEvidenceBlock(strongEvidence)}\n\n` +
        'Provide at most 3 short bullet points in German. Focus on the most relevant next steps first.',
      maxTokens: 160,
    });
    return {
      answer: completion.text || extractiveSynthesisAnswer(strongEvidence),
      explanation: 'Antwort basiert auf abgerufenen Eintraegen.',
      sources: strongEvidence.map((item) => item.source),
      provider: 'workers-ai',
      model: getWorkersAiModel(env),
      fallback: false,
      evidence,
      weak_evidence: false,
      usage: {},
    };
  } catch (error) {
    return {
      answer: extractiveSynthesisAnswer(strongEvidence),
      explanation: error instanceof Error ? error.message : 'Workers AI request failed.',
      sources: strongEvidence.map((item) => item.source),
      provider: env.AI ? 'workers-ai' : 'none',
      model: env.AI ? getWorkersAiModel(env) : 'disabled',
      fallback: true,
      evidence,
      weak_evidence: false,
      usage: {},
    };
  }
}
