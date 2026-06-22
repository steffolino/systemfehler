const DEFAULT_MODEL = '@cf/meta/llama-3.1-8b-instruct';
const DEFAULT_RATE_LIMIT_WINDOW_SECONDS = 60;
const WORKERS_AI_MODEL_ENV_BY_TASK = {
  default: 'CF_AI_MODEL',
  rewrite: 'CF_AI_MODEL_REWRITE',
  synthesize: 'CF_AI_MODEL_SYNTHESIZE',
  plain_language: 'CF_AI_MODEL_PLAIN_LANGUAGE',
  chat_rewrite: 'CF_AI_MODEL_CHAT_REWRITE',
  enrich: 'CF_AI_MODEL_ENRICH',
};
const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 12;
const DEFAULT_CACHE_TTL_RETRIEVE_SECONDS = 180;
const DEFAULT_CACHE_TTL_REWRITE_SECONDS = 3600;
const DEFAULT_CACHE_TTL_SYNTHESIZE_SECONDS = 900;
const DEFAULT_RETRIEVAL_MODE = 'keyword';
const DEFAULT_EXTERNAL_RETRIEVAL_TIMEOUT_MS = 7000;
const MAX_EXTERNAL_EVIDENCE = 12;
const LOW_SIGNAL_URL_TOKENS = [
  '/presse',
  '/mediathek',
  '/sitzungen',
  '/bundeskabinett',
  '/overview',
  '/uebersicht',
  '/lageplan',
  '/anreise',
  '/besucherdienst',
  '/veranstaltungen',
  '/events',
  '/impressum',
  '/datenschutz',
  '/leichte-sprache',
  '/meta/leichte-sprache',
  '/meta/languages',
  '/breg-de',
];
const LOW_SIGNAL_CONTENT_TOKENS = [
  'einwilligung von nutzenden',
  'webverhalten- analysetool',
  'webverhalten-analysetool',
  'webverhalten analysetool',
  'matomo',
  'mit der einwilligung',
  'mit der einwilligung von nutzenden',
  'cookie-einwilligung',
  'cookiehinweis',
  'tracking',
  'nach erteilung der einwilligung',
  'widerruf der einwilligung',
];
const LOW_SIGNAL_TITLE_TOKENS = [
  'was wir tun',
  'pressebereich',
  'lageplan',
  'anreiseinformationen',
  'kommende veranstaltungen',
  'veranstaltungen auf einen blick',
  'übersicht der internetseite',
  'uebersicht der internetseite',
  'bundeskabinett',
  'leichte sprache',
  'einfach-sprache aktiv',
  'digitale angebote',
  'herzlich willkommen',
  'informationen fuer gefluechtete aus der ukraine',
];
const QUERY_STOPWORDS = new Set([
  'der', 'die', 'das', 'den', 'dem', 'des',
  'ein', 'eine', 'einer', 'einem', 'einen',
  'und', 'oder', 'aber', 'doch', 'dass', 'weil',
  'ich', 'du', 'er', 'sie', 'wir', 'ihr',
  'mir', 'mich', 'dir', 'dich', 'uns', 'euch',
  'ist', 'sind', 'war', 'waren', 'wird', 'werden',
  'mit', 'ohne', 'fuer', 'für', 'auf', 'bei', 'von', 'zu', 'im', 'in', 'am', 'an',
  'was', 'wie', 'wo', 'wer', 'wann', 'warum', 'wieso', 'weshalb',
  'nun', 'jetzt', 'heute', 'morgen', 'gestern',
  'bitte', 'danke', 'hallo',
]);
const LIFE_EVENT_TOPICS_ASSET_PATH = '/data/_topics/life_events.json';
const LIFE_EVENT_RESOURCE_PACKS_ASSET_PATH = '/data/_topics/life_event_resource_packs.json';
const TOPIC_LINKS_ASSET_PATH = '/data/_topics/topic_links.json';
const LIFE_EVENT_CACHE_TTL_MS = 5 * 60 * 1000;
const LIFE_EVENT_OVERRIDE_CACHE_TTL_MS = 60 * 1000;
const DEFAULT_GUIDED_DOMAINS = ['benefits', 'aid', 'contacts', 'tools'];
let lifeEventScenarioCache = {
  loadedAt: 0,
  scenarios: [],
};
let lifeEventResourcePackCache = {
  loadedAt: 0,
  packsById: new Map(),
};
let topicLinkCache = {
  loadedAt: 0,
  nodesById: new Map(),
};
let lifeEventOverrideCache = {
  loadedAt: 0,
  overrides: [],
};
let lifeEventReviewTablesReadyPromise = null;
const SOURCE_TIER_RANK = {
  tier_1_law: 4,
  tier_1_official: 4,
  tier_2_official: 3,
  tier_2_ngo_watchdog: 2,
  tier_3_ngo: 2,
  tier_3_press: 1,
  tier_4_academic: 1,
  tier_4_other: 0,
};

function parseJsonSafe(value, fallback = {}) {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function isBoilerplateText(text) {
  if (!text || typeof text !== 'string') return false;
  const lower = text.toLowerCase();
  return LOW_SIGNAL_CONTENT_TOKENS.some((token) => lower.includes(token));
}

function sanitizeText(text) {
  return isBoilerplateText(text) ? '' : text;
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
  const hasEntryJson = typeof row?.entry_json === 'string' && row.entry_json.trim().length > 0;
  const entry = hasEntryJson
    ? parseJsonSafe(row.entry_json, {})
    : {
        title: {
          de: row?.title_de || '',
          en: row?.title_en || '',
          easy_de: row?.title_easy_de || '',
        },
        summary: {
          de: row?.summary_de || '',
          en: row?.summary_en || '',
          easy_de: row?.summary_easy_de || '',
        },
        content: {
          de: row?.content_de || '',
          en: row?.content_en || '',
          easy_de: row?.content_easy_de || '',
        },
        translations: parseJsonSafe(row?.translations, null),
        provenance: parseJsonSafe(row?.provenance, null),
        quality_scores: parseJsonSafe(row?.quality_scores, null),
      };
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
    sanitizeText(getLocalizedString(entry.summary, entry.summary_de || '')),
    sanitizeText(getLocalizedString(entry.content, entry.content_de || '')),

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
    .filter((token) => Boolean(token) && token.length >= 3 && !QUERY_STOPWORDS.has(token));
}

export function normalizeQuery(query) {
  const normalized = normalizedQueryTokens(query).join(' ').trim();
  if (normalized) return normalized;

  // Never collapse to empty for retrieval-facing flows; preserve user intent.
  return String(query || '').trim().toLowerCase();
}

function getClientIp(request) {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('x-forwarded-for') ||
    'unknown'
  );
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function normalizeStringList(value) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => String(item || '').trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

function normalizeBoostMap(value) {
  if (!value || typeof value !== 'object') return {};
  const pairs = Object.entries(value)
    .map(([key, score]) => [String(key || '').trim().toLowerCase(), Number(score)])
    .filter(([key, score]) => Boolean(key) && Number.isFinite(score));
  return Object.fromEntries(pairs);
}

/**
 * Replace German umlauts and ß with their ASCII digraph equivalents so that
 * keyword lists using "ue/ae/oe" forms (e.g. "buergergeld") match user input
 * and entry text that contains the native Unicode characters ("bürgergeld").
 */
function normalizeGermanChars(str) {
  return str
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss');
}

function normalizeForAnswerQuality(value) {
  return normalizeGermanChars(String(value || '').toLowerCase())
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function answerQualityTokens(value) {
  return normalizeForAnswerQuality(value)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !QUERY_STOPWORDS.has(token));
}

function splitAnswerClaims(answer) {
  return String(answer || '')
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+/))
    .map((line) => line.replace(/^[-*]\s*/, '').trim())
    .filter((line) => {
      if (!line) return false;
      if (/^\[?quelle:/i.test(line)) return false;
      if (/^(wahrscheinlich zuerst relevant|amtliche grundlage|ngo-|praktische hilfe|direkte kontakte|kurzantwort|voraussetzungen|was du jetzt tun kannst):?$/i.test(line)) return false;
      return line.length >= 24;
    });
}

function evidenceSupportText(evidence) {
  return (Array.isArray(evidence) ? evidence : [])
    .map((item) => {
      const entry = parseJsonSafe(item?.content, {});
      return [
        getLocalizedString(entry.title, entry.title_de || ''),
        getLocalizedString(entry.summary, entry.summary_de || ''),
        getLocalizedString(entry.content, entry.content_de || ''),
        entry.url || item?.source || '',
        entry.domain || '',
      ].join(' ');
    })
    .join(' ');
}

export function evaluateAnswerGrounding(answer, evidence, query = '') {
  const claims = splitAnswerClaims(answer);
  const supportTokens = new Set(answerQualityTokens(evidenceSupportText(evidence)));
  const queryTokens = new Set(answerQualityTokens(query));
  const unsupportedClaims = [];
  const genericClaims = [];

  for (const claim of claims) {
    const claimTokens = Array.from(new Set(answerQualityTokens(claim)));
    if (claimTokens.length === 0) continue;

    const supportHits = claimTokens.filter((token) => supportTokens.has(token));
    const queryHits = claimTokens.filter((token) => queryTokens.has(token));
    const supportRatio = supportHits.length / claimTokens.length;

    if (supportHits.length < 2 && supportRatio < 0.22) {
      unsupportedClaims.push({
        claim,
        support_hits: supportHits,
        support_ratio: Number(supportRatio.toFixed(3)),
      });
    }
    if (queryTokens.size >= 2 && queryHits.length === 0 && supportRatio < 0.45) {
      genericClaims.push({
        claim,
        reason: 'low_query_specificity',
      });
    }
  }

  const sourceUrls = (Array.isArray(evidence) ? evidence : [])
    .map((item) => String(item?.source || '').trim())
    .filter(Boolean);
  const citedUrls = sourceUrls.filter((url) => String(answer || '').includes(url));

  return {
    checked_claims: claims.length,
    unsupported_claims: unsupportedClaims,
    generic_claims: genericClaims,
    cited_source_count: new Set(citedUrls).size,
    available_source_count: new Set(sourceUrls).size,
    grounded: unsupportedClaims.length === 0,
    query_specific: genericClaims.length <= Math.max(1, Math.floor(claims.length / 3)),
  };
}

function inferAnswerIntent(query) {
  const normalized = normalizeGermanChars(String(query || '').toLowerCase());
  const intents = [];

  if (/\bwo\b/.test(normalized) || /\bzustaendig|\bstelle\b|\badresse\b|\bamt\b/.test(normalized)) {
    intents.push('place');
  }
  if (/beantrag|antrag|formular|online starten|stellen\b/.test(normalized)) {
    intents.push('application');
  }
  if (/wie\s+(viel|hoch)|hoehe|betrag|kosten|regelsatz|regelbedarf/.test(normalized)) {
    intents.push('amount');
  }
  if (/frist|bis wann|deadline|termin|datum/.test(normalized)) {
    intents.push('deadline');
  }
  if (/wer hilft|hilfe|beratung|an wen|kontakt|telefon|e-?mail/.test(normalized)) {
    intents.push('contact');
  }

  return intents.length > 0 ? intents : ['general'];
}

function auditAnswerShape(query, answer, evidence) {
  const intents = inferAnswerIntent(query);
  const normalizedAnswer = normalizeGermanChars(String(answer || '').toLowerCase());
  const normalizedEvidence = normalizeGermanChars(evidenceSupportText(evidence).toLowerCase());
  const findings = [];

  if (!normalizedAnswer.trim()) findings.push('empty_answer');

  if (intents.includes('place')) {
    const hasPlaceCue = /jobcenter|familienkasse|elterngeldstelle|sozialamt|arbeitsagentur|dienststelle|stelle|amt|portal|online|adresse|kontakt|zustaendig/.test(normalizedAnswer);
    if (!hasPlaceCue) findings.push('missing_place_answer');
  }

  if (intents.includes('application')) {
    const hasApplicationCue = /beantrag|antrag|formular|online|portal|stellen|jobcenter|familienkasse|elterngelddigital/.test(normalizedAnswer);
    if (!hasApplicationCue) findings.push('missing_application_answer');
  }

  if (intents.includes('amount')) {
    const hasAmountCue = /euro|betrag|hoehe|regelbedarf|regelsatz|berechn|anspruch/.test(normalizedAnswer);
    if (!hasAmountCue && /euro|betrag|hoehe|regelbedarf|regelsatz|berechn/.test(normalizedEvidence)) {
      findings.push('missing_amount_answer');
    }
  }

  if (intents.includes('deadline')) {
    const hasDeadlineCue = /frist|bis|termin|datum|monat|tag|woche|rueckwirkend/.test(normalizedAnswer);
    if (!hasDeadlineCue && /frist|termin|datum|monat|tag|woche|rueckwirkend/.test(normalizedEvidence)) {
      findings.push('missing_deadline_answer');
    }
  }

  if (intents.includes('contact')) {
    const hasContactCue = /beratung|kontakt|telefon|e-mail|email|stelle|hilfe|hotline|termin/.test(normalizedAnswer);
    if (!hasContactCue) findings.push('missing_contact_answer');
  }

  return {
    passed: findings.length === 0,
    intents,
    findings,
  };
}

function buildQuestionFocusedExtractiveAnswer(query, evidence) {
  const entries = dedupeEvidence(Array.isArray(evidence) ? evidence : [])
    .slice(0, 4)
    .map((item) => {
      const entry = parseJsonSafe(item.content, null);
      if (!entry) return null;
      const title = getLocalizedString(entry.title, entry.title_de || 'Eintrag');
      const summary = firstUsefulSentence(
        getLocalizedString(entry.summary, entry.summary_de || '') ||
        getLocalizedString(entry.content, entry.content_de || ''),
        'Direkt pruefen.'
      );
      return {
        title,
        summary,
        source: entry.url || item.source || '',
        domain: entry.domain || inferEvidenceMeta(item).domain,
      };
    })
    .filter(Boolean);

  if (entries.length === 0) return null;

  const intents = inferAnswerIntent(query);
  const lines = [];

  for (const item of entries.slice(0, 3)) {
    const normalizedTitle = normalizeGermanChars(item.title.toLowerCase());
    if (intents.includes('place') && intents.includes('application')) {
      if (/online|beantrag|antrag|formular|portal/.test(normalizedTitle)) {
        lines.push(`- Antrag starten: ${item.title}.`);
      } else if (item.domain === 'contacts' || /jobcenter|familienkasse|elterngeldstelle|sozialamt|arbeitsagentur|dienststelle/.test(normalizedTitle)) {
        lines.push(`- Zustaendige Stelle finden: ${item.title}.`);
      } else {
        lines.push(`- Fuer den Antrag wichtig: ${item.title}.`);
      }
    } else if (intents.includes('place')) {
      lines.push(`- Passende Stelle pruefen: ${item.title}.`);
    } else if (intents.includes('application')) {
      lines.push(`- Antrag pruefen oder starten: ${item.title}.`);
    } else if (intents.includes('contact')) {
      lines.push(`- Hilfe bekommen: ${item.title}.`);
    } else if (intents.includes('amount')) {
      lines.push(`- Betrag oder Anspruch pruefen: ${item.title}.`);
    } else {
      lines.push(`- Zuerst relevant: ${item.title}.`);
    }

    if (item.summary && !normalizeGermanChars(item.summary.toLowerCase()).includes(normalizedTitle)) {
      lines.push(`  ${item.summary}`);
    }
    if (item.source) lines.push(`[Quelle: ${item.source}]`);
  }

  return lines.join('\n');
}

function normalizeScenarioMatchText(value) {
  return normalizeGermanChars(String(value || '').toLowerCase())
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactScenarioMatchText(value) {
  return normalizeScenarioMatchText(value).replace(/\s+/g, '');
}

async function ensureLifeEventReviewTables(db) {
  if (!db) return;
  if (lifeEventReviewTablesReadyPromise) {
    await lifeEventReviewTablesReadyPromise;
    return;
  }

  const statements = [
    `CREATE TABLE IF NOT EXISTS life_event_review_cases (
      id TEXT PRIMARY KEY,
      query TEXT NOT NULL,
      normalized_query TEXT NOT NULL,
      detected_stages TEXT,
      selected_life_event TEXT,
      editorial_review_reasons TEXT,
      occurrence_count INTEGER NOT NULL DEFAULT 1,
      first_seen TEXT NOT NULL,
      last_seen TEXT NOT NULL,
      resolved_status TEXT NOT NULL DEFAULT 'open',
      resolution_notes TEXT,
      resolved_by TEXT,
      resolved_at TEXT
    )`,
    'CREATE INDEX IF NOT EXISTS idx_life_event_review_cases_status ON life_event_review_cases(resolved_status, last_seen DESC)',
    `CREATE TABLE IF NOT EXISTS life_event_overrides (
      id TEXT PRIMARY KEY,
      trigger_text TEXT NOT NULL,
      normalized_trigger_text TEXT NOT NULL,
      target_life_event TEXT NOT NULL,
      note TEXT,
      reviewer TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      applied_count INTEGER NOT NULL DEFAULT 0,
      last_applied_at TEXT
    )`,
    'CREATE INDEX IF NOT EXISTS idx_life_event_overrides_status ON life_event_overrides(status, updated_at DESC)',
  ];

  lifeEventReviewTablesReadyPromise = (async () => {
    if (typeof db.exec === 'function') {
      await db.exec(statements.join(';\n'));
      return;
    }
    for (const statement of statements) {
      const prepared = db.prepare(statement);
      if (typeof prepared.run !== 'function') return;
      await prepared.run();
    }
  })();

  try {
    await lifeEventReviewTablesReadyPromise;
  } catch (error) {
    lifeEventReviewTablesReadyPromise = null;
    throw error;
  }
}

async function loadActiveLifeEventOverrides(env) {
  const db = env?.DB;
  if (!db) return [];

  const now = Date.now();
  if (
    now - lifeEventOverrideCache.loadedAt < LIFE_EVENT_OVERRIDE_CACHE_TTL_MS &&
    Array.isArray(lifeEventOverrideCache.overrides)
  ) {
    return lifeEventOverrideCache.overrides;
  }

  await ensureLifeEventReviewTables(db);
  const rowsResult = await db
    .prepare('SELECT id, trigger_text, normalized_trigger_text, target_life_event, note, reviewer, status, updated_at FROM life_event_overrides WHERE status = ? ORDER BY updated_at DESC LIMIT 500')
    .bind('active')
    .all();
  const overrides = (rowsResult?.results || []).map((row) => ({
    id: row.id,
    triggerText: String(row.trigger_text || ''),
    normalizedTriggerText: String(row.normalized_trigger_text || ''),
    targetLifeEvent: String(row.target_life_event || '').toLowerCase(),
    note: row.note || null,
    reviewer: row.reviewer || null,
    status: String(row.status || 'active'),
  })).filter((row) => row.triggerText && row.targetLifeEvent);

  lifeEventOverrideCache = {
    loadedAt: now,
    overrides,
  };

  return overrides;
}

function findLifeEventOverride(query, overrides) {
  const normalizedQuery = normalizeScenarioMatchText(query);
  if (!normalizedQuery) return null;

  let best = null;
  for (const override of Array.isArray(overrides) ? overrides : []) {
    const normalizedTrigger = override.normalizedTriggerText || normalizeScenarioMatchText(override.triggerText || '');
    if (!normalizedTrigger) continue;
    const matches = normalizedQuery.includes(normalizedTrigger) || normalizedTrigger.includes(normalizedQuery);
    if (!matches) continue;
    const score = normalizedTrigger.length;
    if (!best || score > best.score) {
      best = {
        override,
        score,
      };
    }
  }

  return best ? best.override : null;
}

function applyLifeEventOverrideToContext(context, override, scenarios) {
  if (!override || !override.targetLifeEvent) return context;
  const target = String(override.targetLifeEvent || '').trim().toLowerCase();
  if (!target) return context;

  const scenarioList = Array.isArray(scenarios) ? scenarios : [];
  const targetScenario = scenarioList.find((scenario) => scenario.id === target);
  if (!targetScenario) return context;

  const existingStages = Array.isArray(context?.stageIds) ? context.stageIds : [];
  const stageIds = [target, ...existingStages.filter((id) => id !== target)];
  const existingMatched = Array.isArray(context?.matchedScenarios) ? context.matchedScenarios : [];
  const matchedScenarios = [
    targetScenario,
    ...existingMatched.filter((scenario) => scenario && scenario.id !== target),
  ];

  return {
    ...context,
    stageIds,
    selectedLifeEvent: target,
    matchedScenarios,
    needsEditorialReview: false,
    editorialReviewReasons: ['manual_override_applied'],
    overrideApplied: true,
    appliedOverrideId: override.id,
    appliedOverrideTarget: target,
  };
}

async function recordLifeEventReviewCase(env, query, stageContext) {
  const db = env?.DB;
  if (!db) return;
  if (!stageContext?.needsEditorialReview) return;

  await ensureLifeEventReviewTables(db);

  const normalizedQuery = normalizeScenarioMatchText(query);
  if (!normalizedQuery) return;
  const caseId = await sha256Hex(`life-event-review::${normalizedQuery}`);
  const now = new Date().toISOString();
  const detectedStages = JSON.stringify(Array.isArray(stageContext.stageIds) ? stageContext.stageIds : []);
  const reviewReasons = JSON.stringify(Array.isArray(stageContext.editorialReviewReasons) ? stageContext.editorialReviewReasons : []);

  await db
    .prepare(
      `INSERT INTO life_event_review_cases (
        id, query, normalized_query, detected_stages, selected_life_event, editorial_review_reasons, occurrence_count, first_seen, last_seen, resolved_status
      ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, 'open')
      ON CONFLICT(id) DO UPDATE SET
        query = excluded.query,
        detected_stages = excluded.detected_stages,
        selected_life_event = excluded.selected_life_event,
        editorial_review_reasons = excluded.editorial_review_reasons,
        occurrence_count = life_event_review_cases.occurrence_count + 1,
        last_seen = excluded.last_seen,
        resolved_status = CASE
          WHEN life_event_review_cases.resolved_status = 'resolved' THEN life_event_review_cases.resolved_status
          ELSE 'open'
        END`
    )
    .bind(
      caseId,
      String(query || '').trim(),
      normalizedQuery,
      detectedStages,
      stageContext.selectedLifeEvent || null,
      reviewReasons,
      now,
      now
    )
    .run();
}

async function recordLifeEventOverrideUsage(env, overrideId) {
  if (!overrideId) return;
  const db = env?.DB;
  if (!db) return;
  await ensureLifeEventReviewTables(db);
  const now = new Date().toISOString();
  await db
    .prepare('UPDATE life_event_overrides SET applied_count = applied_count + 1, last_applied_at = ?, updated_at = ? WHERE id = ?')
    .bind(now, now, overrideId)
    .run();
}

function queryMatchesScenarioKeyword(queryText, keyword) {
  const normalizedKeyword = normalizeScenarioMatchText(keyword);
  if (!normalizedKeyword) return false;
  if (queryText.includes(normalizedKeyword)) return true;

  const compactQuery = compactScenarioMatchText(queryText);
  const compactKeyword = compactScenarioMatchText(normalizedKeyword);
  if (compactKeyword && compactQuery.includes(compactKeyword)) return true;

  const keywordTokens = normalizedKeyword
    .split(/\s+/)
    .filter((token) => token.length >= 3);
  if (keywordTokens.length < 2) return false;
  const queryTokens = new Set(queryText.split(/\s+/).filter(Boolean));
  return keywordTokens.every((token) => queryTokens.has(token));
}

function normalizeLifeEventScenario(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id || '').trim().toLowerCase();
  if (!id) return null;

  const ranking = raw.ranking && typeof raw.ranking === 'object' ? raw.ranking : {};
  const resourceTargets = raw.resource_targets && typeof raw.resource_targets === 'object'
    ? raw.resource_targets
    : {};
  const contactPriority = raw.contact_priority && typeof raw.contact_priority === 'object'
    ? raw.contact_priority
    : {};
  const relevanceGuard = raw.relevance_guard && typeof raw.relevance_guard === 'object'
    ? raw.relevance_guard
    : {};

  return {
    id,
    label_de: String(raw.label_de || '').trim(),
    label_en: String(raw.label_en || '').trim(),
    keywords: normalizeStringList(raw.keywords),
    expansions: normalizeStringList(raw.expansions),
    domains: normalizeStringList(raw.domains),
    ranking: {
      domain_boosts: normalizeBoostMap(ranking.domain_boosts),
      term_boosts: normalizeBoostMap(ranking.term_boosts),
      term_penalties: normalizeBoostMap(ranking.term_penalties),
    },
    resource_targets: {
      documents: normalizeStringList(resourceTargets.documents),
      information: normalizeStringList(resourceTargets.information),
      contacts: normalizeStringList(resourceTargets.contacts),
    },
    contact_priority: {
      name_keywords: normalizeStringList(contactPriority.name_keywords),
      url_keywords: normalizeStringList(contactPriority.url_keywords),
    },
    relevance_guard: {
      required_any: normalizeStringList(relevanceGuard.required_any),
      blocked_any: normalizeStringList(relevanceGuard.blocked_any),
    },
  };
}

function parseLifeEventScenariosPayload(payload) {
  const list = Array.isArray(payload?.scenarios) ? payload.scenarios : [];
  return list
    .map((scenario) => normalizeLifeEventScenario(scenario))
    .filter(Boolean);
}

function normalizePackItem(raw, fallbackDomain) {
  if (!raw || typeof raw !== 'object') return null;
  const url = String(raw.url || '').trim();
  if (!url) return null;
  return {
    title: String(raw.title || '').trim(),
    url,
    domain: String(raw.domain || fallbackDomain || '').trim().toLowerCase(),
    source_tier: String(raw.source_tier || '').trim().toLowerCase(),
  };
}

function parseLifeEventResourcePacksPayload(payload) {
  const scenarios = Array.isArray(payload?.scenarios) ? payload.scenarios : [];
  const packsById = new Map();
  for (const raw of scenarios) {
    const scenarioId = String(raw?.scenario_id || '').trim().toLowerCase();
    if (!scenarioId) continue;
    const resources = raw?.resources && typeof raw.resources === 'object' ? raw.resources : {};
    const documents = Array.isArray(resources.documents)
      ? resources.documents.map((item) => normalizePackItem(item, 'benefits')).filter(Boolean)
      : [];
    const ngoAssistance = Array.isArray(resources.ngo_assistance)
      ? resources.ngo_assistance.map((item) => normalizePackItem(item, 'aid')).filter(Boolean)
      : [];
    const contacts = Array.isArray(resources.contacts)
      ? resources.contacts.map((item) => normalizePackItem(item, 'contacts')).filter(Boolean)
      : [];
    packsById.set(scenarioId, { scenario_id: scenarioId, resources: { documents, ngo_assistance: ngoAssistance, contacts } });
  }
  return packsById;
}

function normalizeTopicLinkNode(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id || '').trim().toLowerCase();
  if (!id) return null;
  return {
    id,
    type: String(raw.type || 'topic').trim().toLowerCase(),
    aliases: normalizeStringList(raw.aliases),
    strong_links: normalizeStringList(raw.strong_links),
    weak_links: normalizeStringList(raw.weak_links),
    blocked_links: normalizeStringList(raw.blocked_links),
    first_answer_order: normalizeStringList(raw.first_answer_order),
  };
}

function parseTopicLinksPayload(payload) {
  const nodes = Array.isArray(payload?.nodes) ? payload.nodes : [];
  const nodesById = new Map();
  for (const raw of nodes) {
    const node = normalizeTopicLinkNode(raw);
    if (node) nodesById.set(node.id, node);
  }
  return nodesById;
}

async function fetchLifeEventScenariosFromAssets(env, requestUrl) {
  if (!env?.ASSETS?.fetch || !requestUrl) return [];
  try {
    const assetUrl = new URL(LIFE_EVENT_TOPICS_ASSET_PATH, requestUrl);
    const response = await env.ASSETS.fetch(new Request(assetUrl.toString()));
    if (!response.ok) return [];
    return parseLifeEventScenariosPayload(await response.json());
  } catch {
    return [];
  }
}

async function fetchLifeEventScenariosFromEnv(env) {
  const raw = String(env?.AI_LIFE_EVENT_SCENARIOS_JSON || '').trim();
  if (!raw) return [];
  try {
    return parseLifeEventScenariosPayload(JSON.parse(raw));
  } catch {
    return [];
  }
}

async function fetchLifeEventResourcePacksFromAssets(env, requestUrl) {
  if (!env?.ASSETS?.fetch || !requestUrl) return new Map();
  try {
    const assetUrl = new URL(LIFE_EVENT_RESOURCE_PACKS_ASSET_PATH, requestUrl);
    const response = await env.ASSETS.fetch(new Request(assetUrl.toString()));
    if (!response.ok) return new Map();
    return parseLifeEventResourcePacksPayload(await response.json());
  } catch {
    return new Map();
  }
}

async function fetchLifeEventResourcePacksFromEnv(env) {
  const raw = String(env?.AI_LIFE_EVENT_RESOURCE_PACKS_JSON || '').trim();
  if (!raw) return new Map();
  try {
    return parseLifeEventResourcePacksPayload(JSON.parse(raw));
  } catch {
    return new Map();
  }
}

async function fetchTopicLinksFromAssets(env, requestUrl) {
  if (!env?.ASSETS?.fetch || !requestUrl) return new Map();
  try {
    const assetUrl = new URL(TOPIC_LINKS_ASSET_PATH, requestUrl);
    const response = await env.ASSETS.fetch(new Request(assetUrl.toString()));
    if (!response.ok) return new Map();
    return parseTopicLinksPayload(await response.json());
  } catch {
    return new Map();
  }
}

async function fetchTopicLinksFromEnv(env) {
  const raw = String(env?.AI_TOPIC_LINKS_JSON || '').trim();
  if (!raw) return new Map();
  try {
    return parseTopicLinksPayload(JSON.parse(raw));
  } catch {
    return new Map();
  }
}

export async function loadLifeEventScenarios(env, options = {}) {
  const forceReload = Boolean(options?.forceReload);
  const explicitScenarios = options?.lifeEventScenarios;
  if (Array.isArray(explicitScenarios) && explicitScenarios.length > 0) {
    return parseLifeEventScenariosPayload({ scenarios: explicitScenarios });
  }

  const now = Date.now();
  if (
    !forceReload &&
    lifeEventScenarioCache.scenarios.length > 0 &&
    now - lifeEventScenarioCache.loadedAt < LIFE_EVENT_CACHE_TTL_MS
  ) {
    return lifeEventScenarioCache.scenarios;
  }

  const fromEnv = await fetchLifeEventScenariosFromEnv(env);
  const fromAssets = fromEnv.length > 0
    ? fromEnv
    : await fetchLifeEventScenariosFromAssets(env, options?.requestUrl || null);
  const scenarios = fromAssets;

  lifeEventScenarioCache = {
    loadedAt: now,
    scenarios,
  };
  return scenarios;
}

export async function loadLifeEventResourcePacks(env, options = {}) {
  const forceReload = Boolean(options?.forceReload);
  const now = Date.now();
  if (
    !forceReload &&
    lifeEventResourcePackCache.packsById.size > 0 &&
    now - lifeEventResourcePackCache.loadedAt < LIFE_EVENT_CACHE_TTL_MS
  ) {
    return lifeEventResourcePackCache.packsById;
  }

  const fromEnv = await fetchLifeEventResourcePacksFromEnv(env);
  const fromAssets = fromEnv.size > 0
    ? fromEnv
    : await fetchLifeEventResourcePacksFromAssets(env, options?.requestUrl || null);
  lifeEventResourcePackCache = {
    loadedAt: now,
    packsById: fromAssets,
  };
  return fromAssets;
}

export async function loadTopicLinks(env, options = {}) {
  const forceReload = Boolean(options?.forceReload);
  const explicitTopicLinks = options?.topicLinks;
  if (explicitTopicLinks instanceof Map) return explicitTopicLinks;
  if (Array.isArray(explicitTopicLinks?.nodes)) {
    return parseTopicLinksPayload(explicitTopicLinks);
  }

  const now = Date.now();
  if (
    !forceReload &&
    topicLinkCache.nodesById.size > 0 &&
    now - topicLinkCache.loadedAt < LIFE_EVENT_CACHE_TTL_MS
  ) {
    return topicLinkCache.nodesById;
  }

  const fromEnv = await fetchTopicLinksFromEnv(env);
  const fromAssets = fromEnv.size > 0
    ? fromEnv
    : await fetchTopicLinksFromAssets(env, options?.requestUrl || null);
  topicLinkCache = {
    loadedAt: now,
    nodesById: fromAssets,
  };
  return fromAssets;
}

export function listLifeEventScenarios(scenarios) {
  return (Array.isArray(scenarios) ? scenarios : []).map((scenario) => ({
    id: scenario.id,
    label_de: scenario.label_de || scenario.id,
    label_en: scenario.label_en || scenario.label_de || scenario.id,
    domains: scenario.domains,
    tagwords: deriveLifeEventTagwords(scenario),
    resource_targets: scenario.resource_targets,
  }));
}

function deriveLifeEventTagwords(scenario) {
  const raw = [
    scenario?.label_de,
    ...(Array.isArray(scenario?.keywords) ? scenario.keywords : []),
    ...(Array.isArray(scenario?.expansions) ? scenario.expansions : []),
    ...(Array.isArray(scenario?.resource_targets?.documents) ? scenario.resource_targets.documents : []),
    ...(Array.isArray(scenario?.resource_targets?.information) ? scenario.resource_targets.information : []),
    ...(Array.isArray(scenario?.resource_targets?.contacts) ? scenario.resource_targets.contacts : []),
  ];
  const stopwords = new Set([
    'und',
    'oder',
    'mit',
    'ohne',
    'fuer',
    'von',
    'bei',
    'der',
    'die',
    'das',
    'ein',
    'eine',
    'geworden',
    'needed',
    'became',
    'with',
    'without',
  ]);
  const seen = new Set();
  const tagwords = [];

  for (const item of raw) {
    const normalized = normalizeScenarioMatchText(item);
    if (!normalized || normalized.length < 4 || stopwords.has(normalized)) continue;
    const parts = normalized.split(/\s+/).filter((part) => part.length >= 4 && !stopwords.has(part));
    const candidates = parts.length > 1 && normalized.length >= 22 ? parts : [normalized];
    for (const candidate of candidates) {
      if (seen.has(candidate)) continue;
      seen.add(candidate);
      tagwords.push(candidate);
      if (tagwords.length >= 12) return tagwords;
    }
  }

  return tagwords;
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function enforceRateLimit(request, env, routeName) {
  const limit = parsePositiveInt(env.AI_RATE_LIMIT_MAX_REQUESTS, DEFAULT_RATE_LIMIT_MAX_REQUESTS);
  const windowSeconds = parsePositiveInt(env.AI_RATE_LIMIT_WINDOW_SECONDS, DEFAULT_RATE_LIMIT_WINDOW_SECONDS);
  const bucketSeconds = Math.floor(Date.now() / 1000 / windowSeconds);
  const clientIp = getClientIp(request);
  const key = `ai-rate:${routeName}:${clientIp}:${bucketSeconds}`;
  const cache = caches.default;
  const cacheKey = new Request(`https://internal.systemfehler.local/${key}`);
  const cached = await cache.match(cacheKey);
  const currentCount = cached ? Number.parseInt(await cached.text(), 10) || 0 : 0;

  if (currentCount >= limit) {
    return {
      allowed: false,
      retryAfter: windowSeconds,
      headers: {
        'Retry-After': String(windowSeconds),
      },
    };
  }

  const nextCount = currentCount + 1;
  await cache.put(
    cacheKey,
    new Response(String(nextCount), {
      headers: {
        'Cache-Control': `public, max-age=${windowSeconds}`,
      },
    })
  );

  return {
    allowed: true,
    remaining: Math.max(0, limit - nextCount),
    headers: {
      'X-RateLimit-Limit': String(limit),
      'X-RateLimit-Remaining': String(Math.max(0, limit - nextCount)),
      'X-RateLimit-Window': String(windowSeconds),
    },
  };
}

export async function getCachedJsonResponse(request, cacheKeyParts) {
  const cache = caches.default;
  const hashed = await sha256Hex(cacheKeyParts.join('::'));
  const cacheKey = new Request(`https://internal.systemfehler.local/cache/${hashed}`);
  const cached = await cache.match(cacheKey);
  return { cache, cacheKey, cached };
}

export async function cacheJsonResponse(cache, cacheKey, payload, ttlSeconds) {
  const response = new Response(JSON.stringify(payload), {
    headers: {
      'content-type': 'application/json',
      'Cache-Control': `public, max-age=${ttlSeconds}`,
    },
  });
  await cache.put(cacheKey, response.clone());
  return response;
}

export function getCacheTtl(env, kind) {
  if (kind === 'retrieve') {
    return parsePositiveInt(env.AI_CACHE_TTL_RETRIEVE_SECONDS, DEFAULT_CACHE_TTL_RETRIEVE_SECONDS);
  }
  if (kind === 'rewrite') {
    return parsePositiveInt(env.AI_CACHE_TTL_REWRITE_SECONDS, DEFAULT_CACHE_TTL_REWRITE_SECONDS);
  }
  return parsePositiveInt(env.AI_CACHE_TTL_SYNTHESIZE_SECONDS, DEFAULT_CACHE_TTL_SYNTHESIZE_SECONDS);
}

function canonicalizeUrl(raw) {
  const url = String(raw || '').trim().toLowerCase();
  if (!url) return '';
  return url.replace(/\/+$/, '');
}

function hasApplicationPlaceIntent(normalizedQuery) {
  return (
    /\bwo\b.*\b(beantrag|antrag|stelle|zustaendig|zuständig|bekomme)\b/.test(normalizedQuery) ||
    /\bwie\b.*\b(beantrag|antrag stellen)\b/.test(normalizedQuery)
  );
}

function applicationSubjectTokens(query) {
  const actionTokens = new Set([
    'beantrag',
    'beantrage',
    'beantragen',
    'antrag',
    'stellen',
    'stelle',
    'zustaendig',
    'zuständig',
    'zustandig',
    'online',
    'bekomme',
    'kann',
  ]);

  return normalizedQueryTokens(query)
    .map((token) => normalizeGermanChars(token.toLowerCase()))
    .filter((token) => token.length >= 4 && !actionTokens.has(token));
}

function scoreEntry(query, entry, context = null, scenarioPack = null) {
  const q = normalizeGermanChars((query || '').toLowerCase());
  const text = entryTextBlob(entry);
  const normalizedText = normalizeGermanChars(text);
  const title = normalizeGermanChars(getLocalizedString(entry.title, entry.title_de || '').toLowerCase());
  const url = canonicalizeUrl(entry.url || '');
  const contextExpansions = Array.isArray(context?.expansions) ? context.expansions : [];
  const strongTopicLinks = Array.isArray(context?.topicLinks) ? context.topicLinks : [];
  const weakTopicLinks = Array.isArray(context?.weakTopicLinks) ? context.weakTopicLinks : [];
  const blockedTopicLinks = Array.isArray(context?.blockedTopicLinks) ? context.blockedTopicLinks : [];
  const firstAnswerOrder = Array.isArray(context?.firstAnswerOrder) ? context.firstAnswerOrder : [];
  const tokens = Array.from(
    new Set([
      ...normalizedQueryTokens(query),
      ...contextExpansions.flatMap((item) => normalizedQueryTokens(item)),
    ])
  );
  let score = 0;

  for (const token of tokens) {
    if (title.includes(token)) score += 3;
    if (text.includes(token)) score += 1.25;
  }

  for (const term of strongTopicLinks) {
    const normalizedTerm = normalizeGermanChars(String(term || '').toLowerCase());
    if (!normalizedTerm) continue;
    if (title.includes(normalizedTerm)) score += 8;
    if (normalizedText.includes(normalizedTerm)) score += 4;
  }

  for (const [index, term] of firstAnswerOrder.entries()) {
    const normalizedTerm = normalizeGermanChars(String(term || '').toLowerCase());
    if (!normalizedTerm) continue;
    if (title.includes(normalizedTerm) || normalizedText.includes(normalizedTerm)) {
      score += Math.max(2, 10 - index * 2);
    }
  }

  for (const term of weakTopicLinks) {
    const normalizedTerm = normalizeGermanChars(String(term || '').toLowerCase());
    if (!normalizedTerm) continue;
    if (q.includes(normalizedTerm) && (title.includes(normalizedTerm) || normalizedText.includes(normalizedTerm))) {
      score += 5;
    }
  }

  for (const term of blockedTopicLinks) {
    const normalizedTerm = normalizeGermanChars(String(term || '').toLowerCase());
    if (!normalizedTerm || q.includes(normalizedTerm)) continue;
    if (title.includes(normalizedTerm) || normalizedText.includes(normalizedTerm)) {
      score -= 22;
    }
  }

  if (q.includes('kontakt') || q.includes('telefon') || q.includes('erreichen')) {
    if (entry.domain === 'contacts') score += 5;
  }

  if (q.includes('arbeitslos')) {
    if (title.includes('arbeitslos melden') || normalizedText.includes('arbeitslos melden')) score += 60;
    if (title.includes('arbeitslosengeld') || normalizedText.includes('arbeitslosengeld beantragen')) score += 24;
    if (url.includes('arbeitslosengeld')) score += 18;
    if (normalizedText.includes('arbeitsagentur und jobcenter vor ort')) score += 42;
    if (
      normalizedText.includes('freiwillige arbeitslosenversicherung') &&
      !q.includes('selbst') &&
      !q.includes('umschulung') &&
      !q.includes('elternzeit') &&
      !q.includes('ausland')
    ) {
      score -= 45;
    }
  }

  if (
    !q.includes('sanktion') &&
    !q.includes('widerspruch') &&
    !q.includes('bescheid') &&
    !q.includes('klage') &&
    (normalizedText.includes('sanktion') || normalizedText.includes('widerspruch') || normalizedText.includes('rechtsberatung'))
  ) {
    score -= 35;
  }

  if (
    !q.includes('migration') &&
    !q.includes('zugewander') &&
    !q.includes('ausland') &&
    !q.includes('aufenthalt') &&
    !q.includes('asyl') &&
    (normalizedText.includes('integrationskurs') ||
      normalizedText.includes('zugewanderte') ||
      normalizedText.includes('migration') ||
      normalizedText.includes('gefluechtete') ||
      normalizedText.includes('ukraine'))
  ) {
    score -= 35;
  }

  if (
    (q.includes('energie') || q.includes('strom') || q.includes('heizkosten') || q.includes('abschaltung')) &&
    !q.includes('wohnung') &&
    !q.includes('obdach') &&
    !q.includes('raeumung') &&
    !q.includes('räumung') &&
    (normalizedText.includes('obdachlos') || normalizedText.includes('wohnungslos') || normalizedText.includes('notunterkunft'))
  ) {
    score -= 45;
  }

  if (q.includes('hilfe') || q.includes('unterstuetz') || q.includes('unterstütz')) {
    if (entry.domain === 'aid') score += 4;
    if (entry.domain === 'contacts') score += 3.5;
    if (entry.domain === 'benefits') score += 2.5;
    if (entry.domain === 'tools') score += 1.5;
  }

  if (q.includes('online') || q.includes('antrag') || q.includes('beantrag')) {
    if (entry.domain === 'tools') score += 3;
    if (text.includes('eservices')) score += 3;
  }

  if (hasApplicationPlaceIntent(q)) {
    const subjectTokens = applicationSubjectTokens(query);
    const subjectHits = subjectTokens.filter((token) =>
      title.includes(token) || url.includes(token) || normalizedText.includes(token)
    );
    const hasApplicationSurface =
      title.includes('beantrag') ||
      title.includes('antrag') ||
      url.includes('beantrag') ||
      url.includes('antrag') ||
      normalizedText.includes('online beantragen') ||
      normalizedText.includes('antrag stellen') ||
      normalizedText.includes('zustaendig') ||
      normalizedText.includes('zuständig') ||
      normalizedText.includes('jobcenter') ||
      normalizedText.includes('familienkasse') ||
      normalizedText.includes('sozialamt');

    if (subjectTokens.length > 0 && subjectHits.length === 0) {
      score -= 18;
    }
    if (subjectHits.length > 0 && hasApplicationSurface) {
      score += 18 + subjectHits.length * 5;
    }
    if (subjectHits.length > 0 && (title.includes('beantrag') || url.includes('beantrag'))) {
      score += 18;
    }
  }

  if (q.includes('buergergeld') && (q.includes('antrag') || q.includes('beantrag') || q.includes('wo kann'))) {
    if (title.includes('buergergeld online beantragen') || url.includes('buergergeld-beantragen')) score += 80;
    if (title.includes('buergergeld') && title.includes('antrag und bescheid')) score += 48;
    if (title.includes('buergergeld') && url.endsWith('/buergergeld')) score += 36;
    if (normalizedText.includes('jobcenter') || url.includes('jobcenter')) score += 22;
    if (title.includes('einkommen') && title.includes('ergaenzen')) score -= 45;
    if (normalizedText.includes('freiwillige arbeitslosenversicherung')) score -= 70;
    if (!q.includes('arbeitslosengeld') && title.includes('arbeitslosengeld')) score -= 28;
  }

  if (q.includes('bildungsgutschein')) {
    if (title.includes('bildungsgutschein') || normalizedText.includes('bildungsgutschein')) score += 18;
    if (title.includes('weiterbildungsfoerderung') || normalizedText.includes('weiterbildungsfoerderung')) score += 10;
    if (url.includes('fbwo')) score += 8;
    if (normalizedText.includes('freiwillige arbeitslosenversicherung')) score -= 14;
    if (normalizedText.includes('berufliche rehabilitation') && !q.includes('rehabilitation') && !q.includes('behinderung')) score -= 8;
  }

  if ((q.includes('elterngeld') || q.includes('kindergeld')) && (q.includes('antrag') || q.includes('beantrag'))) {
    if (normalizedText.includes('beantragen') || normalizedText.includes('antrag stellen')) score += 5;
    if (q.includes('kindergeld') && (title.includes('kindergeld-antrag') || url.includes('kindergeld-antrag'))) score += 18;
    if (q.includes('elterngeld') && normalizedText.includes('elterngelddigital')) score += 14;
    if (q.includes('elterngeld') && normalizedText.includes('elterngeld') && normalizedText.includes('beantragen')) score += 12;
    if (q.includes('kindergeld') && normalizedText.includes('kindergeld-antrag stellen')) score += 45;
    if (q.includes('elterngeld') && title.includes('elterngelddigital')) score += 90;
    if (!q.includes('kinderzuschlag') && normalizedText.includes('kinderzuschlag')) score -= 10;
  }

  if (url.includes('/meta/languages') || normalizedText.includes('oικογενειακές') || normalizedText.includes('paroches')) {
    score -= 60;
  }

  // Hard disambiguation for qualification-recognition intent.
  if (q.includes('berufsanerkennung') || q.includes('abschluss') || q.includes('zeugnisanerkennung')) {
    const professionalSignals =
      text.includes('beruf') ||
      text.includes('qualifikation') ||
      text.includes('zeugnis') ||
      text.includes('gleichwertig') ||
      text.includes('anerkennungsberatung') ||
      text.includes('iq netzwerk') ||
      text.includes('ihk');
    if (!professionalSignals) {
      score -= 18;
    }

    if (
      text.includes('vaterschaft') ||
      text.includes('schuldner') ||
      text.includes('unterhalt') ||
      text.includes('familie') ||
      text.includes('kindergeld')
    ) {
      score -= 24;
    }
  }

  const matchedScenarios = Array.isArray(context?.matchedScenarios) ? context.matchedScenarios : [];
  const selectedLifeEvent = typeof context?.selectedLifeEvent === 'string' ? context.selectedLifeEvent : null;
  for (const scenario of matchedScenarios) {
    const domainBoost = Number(scenario.ranking?.domain_boosts?.[String(entry.domain || '').toLowerCase()] || 0);
    score += domainBoost;

    for (const [term, boost] of Object.entries(scenario.ranking?.term_boosts || {})) {
      if (normalizedText.includes(term)) score += Number(boost || 0);
    }
    for (const [term, penalty] of Object.entries(scenario.ranking?.term_penalties || {})) {
      if (normalizedText.includes(term)) score -= Number(penalty || 0);
    }
    const guardRequired = Array.isArray(scenario.relevance_guard?.required_any)
      ? scenario.relevance_guard.required_any
      : [];
    const guardBlocked = Array.isArray(scenario.relevance_guard?.blocked_any)
      ? scenario.relevance_guard.blocked_any
      : [];
    const applyGuardPenalties =
      matchedScenarios.length <= 1 || (selectedLifeEvent && selectedLifeEvent === scenario.id);
    if (applyGuardPenalties && guardRequired.length > 0 && !guardRequired.some((term) => normalizedText.includes(term))) {
      score -= 16;
    }
    if (applyGuardPenalties && guardBlocked.length > 0 && guardBlocked.some((term) => normalizedText.includes(term))) {
      score -= 18;
    }
    for (const term of guardRequired) {
      if (!term) continue;
      if (title.includes(term) || url.includes(term)) score += 4.5;
    }

    const resourceTargets = scenario.resource_targets || {};
    const resourceSignals = [
      ...(resourceTargets.documents || []),
      ...(resourceTargets.information || []),
      ...(resourceTargets.contacts || []),
    ];
    for (const signal of resourceSignals) {
      if (!signal) continue;
      if (title.includes(signal)) score += 2.75;
      if (text.includes(signal)) score += 1.5;
    }
  }

  if (tokens.length > 0 && score < 2) {
    score -= 3;
  }

  if (scenarioPack && scenarioPack.resources) {
    const urlMatches = (scenarioPack.resources.documents || []).some((item) => canonicalizeUrl(item.url) === url);
    const ngoMatches = (scenarioPack.resources.ngo_assistance || []).some((item) => canonicalizeUrl(item.url) === url);
    const contactMatches = (scenarioPack.resources.contacts || []).some((item) => canonicalizeUrl(item.url) === url);
    if (urlMatches) score += 8;
    if (ngoMatches) score += 10;
    if (contactMatches) score += 12;
  }

  if (entry._curatedLifeEventBridge) {
    score += 18;
  }

  return score;
}

function dedupeScoredEntriesByUrl(scored) {
  const bestByUrl = new Map();
  const withoutUrl = [];
  for (const item of scored) {
    const url = canonicalizeUrl(item?.entry?.url || '');
    if (!url) {
      withoutUrl.push(item);
      continue;
    }
    const existing = bestByUrl.get(url);
    if (!existing || Number(item.score || 0) > Number(existing.score || 0)) {
      bestByUrl.set(url, item);
    }
  }
  return [...bestByUrl.values(), ...withoutUrl].sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
}

function isLowSignalEntry(entry) {
  const title = getLocalizedString(entry.title, entry.title_de || '').toLowerCase();
  const url = String(entry.url || '').toLowerCase();
  if (!title && !url) return true;
  if (LOW_SIGNAL_URL_TOKENS.some((token) => url.includes(token))) return true;
  if (LOW_SIGNAL_TITLE_TOKENS.some((token) => title.includes(token))) return true;
  return false;
}

function guidedSearchDomains(query) {
  const q = String(query || '').toLowerCase();
  const isOrgIntent =
    q.includes('organisation') ||
    q.includes('organisationen') ||
    q.includes('traeger') ||
    q.includes('verband');
  const domains = [...DEFAULT_GUIDED_DOMAINS];
  if (isOrgIntent) {
    domains.push('organizations');
  }
  return domains;
}

function findLifeEventById(scenarios, lifeEventId) {
  if (typeof lifeEventId !== 'string' || !lifeEventId.trim()) return null;
  const normalized = lifeEventId.trim().toLowerCase();
  return (Array.isArray(scenarios) ? scenarios : []).find((scenario) => scenario.id === normalized) || null;
}

function scoreMatchedScenario(queryText, scenario) {
  const matchedKeywords = (scenario.keywords || []).filter((keyword) => queryMatchesScenarioKeyword(queryText, keyword));
  if (matchedKeywords.length === 0) return null;

  let score = 0;
  for (const keyword of matchedKeywords) {
    const normalizedKeyword = normalizeScenarioMatchText(keyword);
    if (!normalizedKeyword) continue;
    const tokenCount = normalizedKeyword.split(/\s+/).filter(Boolean).length;
    score += tokenCount >= 2 ? 3 : 1.5;
  }

  const compactQuery = compactScenarioMatchText(queryText);

  // Penalize known semantic drift where completed education is confused with upskilling.
  if (scenario.id === 'upskilling') {
    const hasCompletedEducationSignal =
      compactQuery.includes('ausbildungbeendet') ||
      compactQuery.includes('ausbildungabgeschlossen') ||
      compactQuery.includes('nachausbildung');
    const hasUpskillingSignal =
      compactQuery.includes('weiterbildung') ||
      compactQuery.includes('umschulung') ||
      compactQuery.includes('bildungsgutschein') ||
      compactQuery.includes('qualifizierung');
    if (hasCompletedEducationSignal && !hasUpskillingSignal) {
      score -= 8;
    }
  }

  return {
    scenario,
    score,
    matchedKeywords,
  };
}

function inferUserStageContext(query, scenarios, forcedLifeEventId = null) {
  const q = normalizeScenarioMatchText(query);
  const list = Array.isArray(scenarios) ? scenarios : [];
  const scoredMatches = list
    .map((rule) => scoreMatchedScenario(q, rule))
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);
  const matchedRules = scoredMatches.map((item) => item.scenario);
  const forcedScenario = findLifeEventById(list, forcedLifeEventId);

  const effectiveRules = forcedScenario
    ? [forcedScenario, ...matchedRules.filter((rule) => rule.id !== forcedScenario.id)]
    : matchedRules;

  if (effectiveRules.length === 0) {
    return {
      stageIds: [],
      expansions: [],
      domains: guidedSearchDomains(query),
      selectedLifeEvent: null,
      matchedScenarios: [],
      needsEditorialReview: false,
      editorialReviewReasons: [],
      overrideApplied: false,
      appliedOverrideId: null,
      appliedOverrideTarget: null,
    };
  }

  const scoredEffective = effectiveRules
    .map((rule) => {
      const matched = scoredMatches.find((item) => item.scenario.id === rule.id);
      return {
        rule,
        score: matched ? matched.score : 0,
      };
    })
    .sort((a, b) => b.score - a.score);

  const editorialReviewReasons = [];
  const topScore = scoredEffective[0]?.score ?? 0;
  const secondScore = scoredEffective[1]?.score ?? Number.NEGATIVE_INFINITY;
  const scoreGap = topScore - secondScore;
  const isAmbiguous = scoredEffective.length > 1 && scoreGap < 2;
  if (isAmbiguous) {
    editorialReviewReasons.push('multiple_stage_candidates_close_score');
  }

  if (
    scoredEffective.some((item) => item.rule.id === 'upskilling' && item.score < 0)
  ) {
    editorialReviewReasons.push('upskilling_penalized_completed_education_signal');
  }

  const expansions = Array.from(
    new Set(
      effectiveRules.flatMap((rule) => rule.expansions || [])
    )
  );
  const domains = Array.from(
    new Set(
      effectiveRules.flatMap((rule) => rule.domains || [])
    )
  );

  return {
    stageIds: scoredEffective.map((item) => item.rule.id),
    expansions,
    domains: domains.length > 0 ? domains : guidedSearchDomains(query),
    selectedLifeEvent: forcedScenario
      ? forcedScenario.id
      : scoredEffective.length === 1
        ? scoredEffective[0].rule.id
        : !isAmbiguous && (scoredEffective[0]?.score ?? 0) > 0
          ? scoredEffective[0].rule.id
          : null,
    matchedScenarios: effectiveRules,
    needsEditorialReview: editorialReviewReasons.length > 0,
    editorialReviewReasons,
    overrideApplied: false,
    appliedOverrideId: null,
    appliedOverrideTarget: null,
  };
}

function topicNodeMatchesQuery(node, query) {
  const q = normalizeScenarioMatchText(query);
  return (node.aliases || []).some((alias) => queryMatchesScenarioKeyword(q, alias));
}

function applyTopicLinksToContext(context, topicLinks, query = '') {
  const links = topicLinks instanceof Map ? topicLinks : parseTopicLinksPayload(topicLinks || {});
  if (!links || links.size === 0) {
    return {
      ...context,
      topicLinks: [],
      weakTopicLinks: [],
      blockedTopicLinks: [],
      firstAnswerOrder: [],
    };
  }

  const contextIds = new Set([
    context?.selectedLifeEvent,
    ...(Array.isArray(context?.stageIds) ? context.stageIds : []),
    ...(Array.isArray(context?.matchedScenarios) ? context.matchedScenarios.map((scenario) => scenario.id) : []),
  ].filter(Boolean));

  const matchedNodes = Array.from(links.values()).filter((node) =>
    contextIds.has(node.id) || topicNodeMatchesQuery(node, query)
  );
  if (matchedNodes.length === 0) {
    return {
      ...context,
      topicLinks: [],
      weakTopicLinks: [],
      blockedTopicLinks: [],
      firstAnswerOrder: [],
    };
  }

  const strongLinks = Array.from(new Set(matchedNodes.flatMap((node) => node.strong_links || [])));
  const weakLinks = Array.from(new Set(matchedNodes.flatMap((node) => node.weak_links || [])));
  const blockedLinks = Array.from(new Set(matchedNodes.flatMap((node) => node.blocked_links || [])));
  const firstAnswerOrder = Array.from(new Set(matchedNodes.flatMap((node) => node.first_answer_order || [])));

  return {
    ...context,
    expansions: Array.from(new Set([...(context.expansions || []), ...strongLinks])),
    topicLinks: strongLinks,
    weakTopicLinks: weakLinks,
    blockedTopicLinks: blockedLinks,
    firstAnswerOrder,
    matchedTopicLinkNodes: matchedNodes.map((node) => node.id),
  };
}

function applyScenarioRelevanceGuard(entries, scenario) {
  if (!scenario || typeof scenario !== 'object') return entries;
  const required = Array.isArray(scenario.relevance_guard?.required_any)
    ? scenario.relevance_guard.required_any
    : [];
  const blocked = Array.isArray(scenario.relevance_guard?.blocked_any)
    ? scenario.relevance_guard.blocked_any
    : [];
  if (required.length === 0 && blocked.length === 0) return entries;

  const filtered = entries.filter((entry) => {
    const blob = entryTextBlob(entry);
    if (required.length > 0 && !required.some((signal) => blob.includes(signal))) return false;
    if (blocked.length > 0 && blocked.some((signal) => blob.includes(signal))) return false;
    return true;
  });

  // Never let an over-strict guard erase all evidence.
  return filtered.length > 0 ? filtered : entries;
}

function confidenceFromScore(score) {
  if (score >= 12) return 0.92;
  if (score >= 9) return 0.86;
  if (score >= 6) return 0.79;
  if (score >= 4) return 0.72;
  return 0.55;
}

function entryMatchesScenarioSignals(entry, scenario) {
  if (!entry || !scenario) return false;
  const blob = entryTextBlob(entry);
  const signals = (Array.isArray(scenario.relevance_guard?.required_any) ? scenario.relevance_guard.required_any : [])
    .map((signal) => normalizeScenarioMatchText(signal))
    .filter((signal) => signal && signal.length >= 4);

  return signals.some((signal) => blob.includes(signal));
}

function diversifyScoredEntries(scoredEntries, context, limit = 12) {
  const sorted = [...(Array.isArray(scoredEntries) ? scoredEntries : [])]
    .sort((a, b) => b.score - a.score);
  if (sorted.length <= 1) return sorted.slice(0, limit);

  const selected = [];
  const used = new Set();
  const matchedScenarios = Array.isArray(context?.matchedScenarios) ? context.matchedScenarios : [];
  const targetDomains = Array.from(
    new Set(
      matchedScenarios.flatMap((scenario) => scenario.domains || [])
    )
  ).slice(0, 4);

  // Keep the single best-scoring hit at rank 1.
  selected.push(sorted[0]);
  used.add(0);

  // Compound life-event queries need at least one evidence item per detected
  // situation; otherwise one strong family/employment cluster can bury another
  // explicit signal such as illness.
  for (const scenario of matchedScenarios) {
    if (selected.length >= limit) break;
    if (selected.some((item) => entryMatchesScenarioSignals(item.entry, scenario))) continue;
    const index = sorted.findIndex((item, idx) =>
      !used.has(idx) && entryMatchesScenarioSignals(item.entry, scenario)
    );
    if (index >= 0) {
      selected.push(sorted[index]);
      used.add(index);
    }
  }

  // Then ensure domain diversity for remaining ranks.
  for (const domain of targetDomains) {
    const index = sorted.findIndex((item, idx) =>
      !used.has(idx) && String(item?.entry?.domain || '').toLowerCase() === domain
    );
    if (index >= 0) {
      selected.push(sorted[index]);
      used.add(index);
    }
  }

  sorted.forEach((item, idx) => {
    if (selected.length >= limit) return;
    if (used.has(idx)) return;
    selected.push(item);
  });

  return selected.slice(0, limit);
}

function normalizeTierValue(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function getTierRank(value) {
  return SOURCE_TIER_RANK[normalizeTierValue(value)] ?? -1;
}

function inferEvidenceMeta(item) {
  const entry = parseJsonSafe(item.content, {});
  const provenance = entry.provenance && typeof entry.provenance === 'object' ? entry.provenance : {};
  const sourceTier =
    normalizeTierValue(provenance.sourceTier) ||
    normalizeTierValue(entry.source_tier) ||
    normalizeTierValue(entry.sourceTier) ||
    'unknown';
  const sourceRole =
    typeof provenance.sourceRole === 'string'
      ? provenance.sourceRole
      : sourceTier.startsWith('tier_1_') || sourceTier === 'tier_2_official'
        ? 'official_info'
        : entry.domain === 'tools'
          ? 'trusted_tool'
          : 'context_info';
  const institutionType =
    normalizeTierValue(provenance.institutionType) ||
    normalizeTierValue(entry.institution_type) ||
    normalizeTierValue(entry.institutionType) ||
    'unknown';

  return {
    sourceTier,
    sourceRole,
    institutionType,
    domain: typeof entry.domain === 'string' ? entry.domain : 'unknown',
    url: typeof entry.url === 'string' ? entry.url : item.source || '',
  };
}

function splitEvidenceLanes(evidence) {
  const official = [];
  const assistive = [];
  const contacts = [];
  const context = [];

  for (const item of evidence) {
    const meta = inferEvidenceMeta(item);
    const tier = meta.sourceTier;
    const domain = String(meta.domain || '').toLowerCase();
    const institutionType = String(meta.institutionType || '').toLowerCase();
    const isAssistiveDomain = domain === 'aid' || domain === 'tools';
    const isContact =
      domain === 'contacts' ||
      /kontakt|beratung|hotline|telefon|ansprechpartner|sprechstunde/.test(String(meta.url || '').toLowerCase());
    const isNgoAssistive =
      tier === 'tier_3_ngo' ||
      tier === 'tier_2_ngo_watchdog' ||
      institutionType === 'ngo' ||
      institutionType === 'advisory' ||
      institutionType === 'public_service' ||
      isAssistiveDomain;
    const isOfficial =
      !isContact &&
      !isAssistiveDomain &&
      (
        tier.startsWith('tier_1_') ||
        tier === 'tier_2_official' ||
        meta.sourceRole === 'official_info'
      );
    const isAssistive = !isOfficial && !isContact && isNgoAssistive;

    if (isContact) {
      contacts.push(item);
    } else if (isOfficial) {
      official.push(item);
    } else if (isAssistive) {
      assistive.push(item);
    } else {
      context.push(item);
    }
  }

  return {
    official: official.slice(0, 5),
    assistive: assistive.slice(0, 5),
    contacts: contacts.slice(0, 5),
    context: context.slice(0, 5),
  };
}

function filterEvidenceByPolicy(evidence, options) {
  const strictOfficial = Boolean(options?.strictOfficial);
  const minSourceTier = normalizeTierValue(options?.minSourceTier || '');
  const minTierRank = minSourceTier ? getTierRank(minSourceTier) : -1;
  const minConfidence = Number.isFinite(options?.minConfidence)
    ? Math.max(0, Math.min(1, Number(options.minConfidence)))
    : 0;

  const accepted = [];
  let droppedByPolicy = 0;

  for (const item of evidence) {
    const meta = inferEvidenceMeta(item);
    const tierRank = getTierRank(meta.sourceTier);

    if (Number(item.confidence || 0) < minConfidence) {
      droppedByPolicy += 1;
      continue;
    }

    if (minTierRank >= 0 && tierRank < minTierRank) {
      droppedByPolicy += 1;
      continue;
    }

    if (strictOfficial && meta.sourceRole !== 'official_info') {
      droppedByPolicy += 1;
      continue;
    }

    accepted.push(item);
  }

  return {
    evidence: accepted,
    droppedByPolicy,
  };
}

function normalizeExternalEvidenceItem(item) {
  if (!item || typeof item !== 'object') return null;

  const source = typeof item.source === 'string' && item.source.trim()
    ? item.source.trim()
    : typeof item.url === 'string' && item.url.trim()
      ? item.url.trim()
      : 'unknown';
  const confidence = Number.isFinite(item.confidence)
    ? Math.max(0, Math.min(1, Number(item.confidence)))
    : 0.6;

  let content = item.content;
  if (typeof content !== 'string') {
    try {
      content = JSON.stringify(content || {});
    } catch {
      content = '{}';
    }
  }

  return {
    source,
    content,
    confidence,
  };
}

function normalizeExternalEvidencePayload(payload) {
  if (Array.isArray(payload)) {
    return payload.map(normalizeExternalEvidenceItem).filter(Boolean).slice(0, MAX_EXTERNAL_EVIDENCE);
  }
  if (payload && typeof payload === 'object' && Array.isArray(payload.evidence)) {
    return payload.evidence.map(normalizeExternalEvidenceItem).filter(Boolean).slice(0, MAX_EXTERNAL_EVIDENCE);
  }
  return [];
}

function parseAllowedHosts(raw) {
  return String(raw || '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

function isExternalEndpointAllowed(url, env) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const allowedHosts = parseAllowedHosts(env.AI_RETRIEVAL_ALLOWED_HOSTS);
    if (allowedHosts.length === 0) {
      return true;
    }
    return allowedHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  } catch {
    return false;
  }
}

function getExternalRetrievalConfig(env) {
  const endpoint = String(env.AI_RETRIEVAL_ENDPOINT || '').trim();
  const timeoutMs = Math.min(
    15000,
    parsePositiveInt(env.AI_RETRIEVAL_TIMEOUT_MS, DEFAULT_EXTERNAL_RETRIEVAL_TIMEOUT_MS)
  );

  return {
    endpoint,
    apiKey: String(env.AI_RETRIEVAL_API_KEY || '').trim(),
    timeoutMs,
    configured: Boolean(endpoint),
    allowed: endpoint ? isExternalEndpointAllowed(endpoint, env) : false,
  };
}

async function retrieveKeywordEvidence(env, query, options = {}) {
  const db = env.DB;
  if (!db || !query?.trim()) return [];

  let context = inferUserStageContext(
    query,
    options.lifeEventScenarios || [],
    options.lifeEventId || null
  );
  context = applyTopicLinksToContext(context, options.topicLinks || new Map(), query);
  const scenarioPack = options.scenarioPack || null;
  const expandedQuery = `${query} ${context.expansions.join(' ')}`.trim();
  const tokenCandidates = normalizedQueryTokens(expandedQuery).slice(0, 12);
  const tokens = tokenCandidates.length > 0 ? tokenCandidates : [query.trim().toLowerCase()];
  const allowedDomains = context.domains;
  const domainPlaceholders = allowedDomains.map(() => '?').join(', ');
  const clauses = [];
  const binds = ['active', ...allowedDomains];

  for (const token of tokens) {
    const needle = `%${token}%`;
    clauses.push(
      '(LOWER(title_de) LIKE LOWER(?) OR LOWER(title_en) LIKE LOWER(?) OR LOWER(title_easy_de) LIKE LOWER(?) OR LOWER(url) LIKE LOWER(?) OR LOWER(summary_de) LIKE LOWER(?) OR LOWER(content_de) LIKE LOWER(?) OR LOWER(entry_json) LIKE LOWER(?))'
    );
    binds.push(needle, needle, needle, needle, needle, needle, needle);
  }

  const rowsQuery =
    'SELECT id, domain, url, status, title_de, title_en, title_easy_de, summary_de, summary_en, summary_easy_de, content_de, content_en, content_easy_de, provenance, translations, quality_scores, updated_at, entry_json FROM entries ' +
    `WHERE status = ? AND domain IN (${domainPlaceholders}) AND (${clauses.join(' OR ')}) ` +
    'ORDER BY updated_at DESC LIMIT 120';

  let result;
  try {
    result = await db.prepare(rowsQuery).bind(...binds).all();
  } catch (error) {
    const message = String(error?.message || '');
    if (!message.includes('no such column: entry_json')) {
      throw error;
    }

    const legacyClauses = [];
    const legacyBinds = ['active', ...allowedDomains];
    for (const token of tokens) {
      const needle = `%${token}%`;
      legacyClauses.push(
        '(LOWER(title_de) LIKE LOWER(?) OR LOWER(url) LIKE LOWER(?) OR LOWER(summary_de) LIKE LOWER(?) OR LOWER(content_de) LIKE LOWER(?))'
      );
      legacyBinds.push(needle, needle, needle, needle);
    }

    const legacyRowsQuery =
      'SELECT id, domain, url, status, title_de, title_en, title_easy_de, summary_de, summary_en, summary_easy_de, content_de, content_en, content_easy_de, provenance, translations, quality_scores, updated_at FROM entries ' +
      `WHERE status = ? AND domain IN (${domainPlaceholders}) AND (${legacyClauses.join(' OR ')}) ` +
      'ORDER BY updated_at DESC LIMIT 120';
    result = await db.prepare(legacyRowsQuery).bind(...legacyBinds).all();
  }

  let rows = Array.isArray(result?.results) ? result.results : [];

  if (rows.length === 0) {
    const fallbackQuery =
      'SELECT id, domain, url, status, title_de, title_en, title_easy_de, summary_de, summary_en, summary_easy_de, content_de, content_en, content_easy_de, provenance, translations, quality_scores, updated_at, entry_json FROM entries ' +
      `WHERE status = ? AND domain IN (${domainPlaceholders}) ` +
      'ORDER BY updated_at DESC LIMIT 180';

    try {
      const fallbackResult = await db.prepare(fallbackQuery).bind('active', ...allowedDomains).all();
      rows = Array.isArray(fallbackResult?.results) ? fallbackResult.results : [];
    } catch (error) {
      const message = String(error?.message || '');
      if (!message.includes('no such column: entry_json')) {
        throw error;
      }

      const fallbackLegacyQuery =
        'SELECT id, domain, url, status, title_de, title_en, title_easy_de, summary_de, summary_en, summary_easy_de, content_de, content_en, content_easy_de, provenance, translations, quality_scores, updated_at FROM entries ' +
        `WHERE status = ? AND domain IN (${domainPlaceholders}) ` +
        'ORDER BY updated_at DESC LIMIT 180';
      const fallbackLegacyResult = await db.prepare(fallbackLegacyQuery).bind('active', ...allowedDomains).all();
      rows = Array.isArray(fallbackLegacyResult?.results) ? fallbackLegacyResult.results : [];
    }
  }

  let normalizedEntries = rows.map((row) => normalizeEntryRow(row));

  const selectedScenario = Array.isArray(context.matchedScenarios)
    ? context.matchedScenarios.find((scenario) => scenario.id === context.selectedLifeEvent) || null
    : null;
  if (selectedScenario) {
    normalizedEntries = applyScenarioRelevanceGuard(normalizedEntries, selectedScenario);
  } else if (Array.isArray(context.matchedScenarios) && context.matchedScenarios.length === 1) {
    normalizedEntries = applyScenarioRelevanceGuard(normalizedEntries, context.matchedScenarios[0]);
  }

  if (context.selectedLifeEvent === 'recognition_missing') {
    const requiredSignals = [
      'berufsanerkennung',
      'anerkennungsberatung',
      'zeugnisbewertung',
      'gleichwertigkeit',
      'qualifikation',
      'abschluss',
      'anerkennungsgesetz',
    ];
    const blockedSignals = [
      'vaterschaft',
      'schuldner',
      'unterhalt',
      'kindergeld',
      'kinderzuschlag',
      'familienkasse',
    ];

    const narrowedEntries = normalizedEntries.filter((entry) => {
      const blob = entryTextBlob(entry);
      const hasRequired = requiredSignals.some((signal) => blob.includes(signal));
      const hasBlocked = blockedSignals.some((signal) => blob.includes(signal));
      return hasRequired && !hasBlocked;
    });
    if (narrowedEntries.length > 0) {
      normalizedEntries = narrowedEntries;
    }
  }

  const scoredAll = normalizedEntries
    .filter((entry) => !isLowSignalEntry(entry))
    .map((entry) => ({ entry, score: scoreEntry(query, entry, context, scenarioPack) }))
    .sort((a, b) => b.score - a.score);

  const positiveScored = scoredAll.filter((item) => item.score > 0);
  const ranked = positiveScored.length > 0 ? positiveScored : scoredAll.slice(0, 24);

  return diversifyScoredEntries(ranked, context, 8)
    .map(({ entry, score }) => ({
      source: entry.url || 'unknown',
      content: JSON.stringify(entry),
      confidence: confidenceFromScore(score > 0 ? score : 1),
    }));
}

async function retrieveExternalEvidence(env, query, maxResults) {
  const external = getExternalRetrievalConfig(env);
  if (!external.configured) {
    return { evidence: [], status: 'not_configured' };
  }
  if (!external.allowed) {
    return { evidence: [], status: 'blocked_host' };
  }

  const headers = {
    'content-type': 'application/json',
  };
  if (external.apiKey) {
    headers.Authorization = `Bearer ${external.apiKey}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), external.timeoutMs);

  try {
    const response = await fetch(external.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query,
        limit: maxResults,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return { evidence: [], status: `http_${response.status}` };
    }

    const payload = await response.json();
    return {
      evidence: normalizeExternalEvidencePayload(payload),
      status: 'ok',
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { evidence: [], status: 'timeout' };
    }
    return { evidence: [], status: 'error' };
  } finally {
    clearTimeout(timeout);
  }
}

function dedupeEvidence(evidence) {
  const seen = new Set();
  const merged = [];

  for (const item of evidence) {
    const key = `${item.source || ''}|${item.content || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }

  return merged;
}

export function getRetrievalConfig(env, options = {}) {
  const requestedMode = String(options?.retrievalMode || env.AI_RETRIEVAL_MODE || DEFAULT_RETRIEVAL_MODE)
    .trim()
    .toLowerCase();
  const normalizedMode = ['keyword', 'hybrid', 'external'].includes(requestedMode)
    ? requestedMode
    : DEFAULT_RETRIEVAL_MODE;

  const strictOfficial =
    options?.strictOfficial !== undefined
      ? Boolean(options.strictOfficial)
      : parseBoolean(env.AI_RETRIEVAL_STRICT_OFFICIAL, false);

  const minSourceTier = String(options?.minSourceTier || env.AI_RETRIEVAL_MIN_SOURCE_TIER || '')
    .trim()
    .toLowerCase();

  const minConfidenceRaw =
    options?.minConfidence !== undefined
      ? Number(options.minConfidence)
      : Number(env.AI_RETRIEVAL_MIN_CONFIDENCE || '0');
  const minConfidence = Number.isFinite(minConfidenceRaw)
    ? Math.max(0, Math.min(1, minConfidenceRaw))
    : 0;

  const external = getExternalRetrievalConfig(env);
  const activeMode =
    (normalizedMode === 'hybrid' || normalizedMode === 'external') && external.configured && external.allowed
      ? normalizedMode
      : 'keyword';

  return {
    requestedMode: normalizedMode,
    activeMode,
    strictOfficial,
    minSourceTier: minSourceTier || null,
    minConfidence,
    external,
  };
}

export async function retrieveEvidence(env, query, options = {}) {
  const config = getRetrievalConfig(env, options);
  const scenarios = await loadLifeEventScenarios(env, {
    requestUrl: options.requestUrl || null,
    lifeEventScenarios: options.lifeEventScenarios,
  });
  const topicLinks = await loadTopicLinks(env, {
    requestUrl: options.requestUrl || null,
    topicLinks: options.topicLinks,
  });
  const resourcePacks = await loadLifeEventResourcePacks(env, {
    requestUrl: options.requestUrl || null,
  });
  let stageContext = inferUserStageContext(query, scenarios, options.lifeEventId || null);
  stageContext = applyTopicLinksToContext(stageContext, topicLinks, query);
  let appliedOverrideId = null;
  if (!options.lifeEventId) {
    try {
      const overrides = await loadActiveLifeEventOverrides(env);
      const matchedOverride = findLifeEventOverride(query, overrides);
      if (matchedOverride) {
        stageContext = applyLifeEventOverrideToContext(stageContext, matchedOverride, scenarios);
        stageContext = applyTopicLinksToContext(stageContext, topicLinks, query);
        appliedOverrideId = matchedOverride.id;
      }
    } catch (error) {
      console.error('life-event override lookup failed:', error);
    }
  }

  if (appliedOverrideId) {
    try {
      await recordLifeEventOverrideUsage(env, appliedOverrideId);
    } catch (error) {
      console.error('life-event override usage tracking failed:', error);
    }
  }

  try {
    await recordLifeEventReviewCase(env, query, stageContext);
  } catch (error) {
    console.error('life-event review case logging failed:', error);
  }
  const selectedPack = stageContext.selectedLifeEvent
    ? resourcePacks.get(stageContext.selectedLifeEvent) || null
    : null;
  const diagnostics = {
    requested_mode: config.requestedMode,
    retrieval_mode: config.activeMode,
    strict_official: config.strictOfficial,
    min_source_tier: config.minSourceTier,
    min_confidence: config.minConfidence,
    external_configured: config.external.configured,
    external_status: 'unused',
    evidence_before_filter: 0,
    evidence_after_filter: 0,
    dropped_by_policy: 0,
    fallback: false,
    detected_stages: stageContext.stageIds,
    selected_life_event: stageContext.selectedLifeEvent,
    editorial_review_required: Boolean(stageContext.needsEditorialReview),
    editorial_review_reasons: Array.isArray(stageContext.editorialReviewReasons)
      ? stageContext.editorialReviewReasons
      : [],
    override_applied: Boolean(stageContext.overrideApplied),
    override_id: stageContext.appliedOverrideId || null,
    override_target_life_event: stageContext.appliedOverrideTarget || null,
    stage_domains: stageContext.domains,
    topic_links: stageContext.topicLinks || [],
    weak_topic_links: stageContext.weakTopicLinks || [],
    blocked_topic_links: stageContext.blockedTopicLinks || [],
    first_answer_order: stageContext.firstAnswerOrder || [],
    matched_topic_link_nodes: stageContext.matchedTopicLinkNodes || [],
    scenario_resources: stageContext.matchedScenarios.map((scenario) => ({
      id: scenario.id,
      resource_targets: scenario.resource_targets,
      contact_priority: scenario.contact_priority,
      curated_resources:
        stageContext.selectedLifeEvent === scenario.id && selectedPack
          ? selectedPack.resources
          : null,
    })),
  };

  const effectiveLifeEventId = options.lifeEventId || stageContext.selectedLifeEvent || null;
  const keywordEvidence = await retrieveKeywordEvidence(env, query, {
    lifeEventId: effectiveLifeEventId,
    lifeEventScenarios: scenarios,
    scenarioPack: effectiveLifeEventId ? selectedPack : null,
    topicLinks,
  });
  const curatedEvidence = selectedPack
    ? buildCuratedEvidenceFromScenarioResources([
        {
          id: selectedPack.scenario_id,
          curated_resources: selectedPack.resources,
        },
      ])
    : [];
  const shouldAddCuratedEvidence = curatedEvidence.length > 0;
  let combinedEvidence = shouldAddCuratedEvidence
    ? dedupeEvidence([...keywordEvidence, ...curatedEvidence])
    : keywordEvidence;

  if (config.activeMode === 'hybrid' || config.activeMode === 'external') {
    const externalResult = await retrieveExternalEvidence(env, query, MAX_EXTERNAL_EVIDENCE);
    diagnostics.external_status = externalResult.status;

    if (externalResult.status === 'ok') {
      combinedEvidence = config.activeMode === 'external'
        ? externalResult.evidence
        : dedupeEvidence([
            ...externalResult.evidence,
            ...keywordEvidence,
            ...(shouldAddCuratedEvidence ? curatedEvidence : []),
          ]);
    } else if (config.activeMode === 'external') {
      diagnostics.fallback = true;
      diagnostics.retrieval_mode = 'keyword';
      combinedEvidence = shouldAddCuratedEvidence
        ? dedupeEvidence([...keywordEvidence, ...curatedEvidence])
        : keywordEvidence;
    }
  }

  diagnostics.evidence_before_filter = combinedEvidence.length;

  const filtered = filterEvidenceByPolicy(combinedEvidence, {
    strictOfficial: config.strictOfficial,
    minSourceTier: config.minSourceTier,
    minConfidence: config.minConfidence,
  });
  diagnostics.dropped_by_policy = filtered.droppedByPolicy;

  const evidence = filtered.evidence
    .sort((a, b) => Number(b.confidence || 0) - Number(a.confidence || 0))
    .slice(0, 8);
  diagnostics.evidence_after_filter = evidence.length;
  const lanes = splitEvidenceLanes(evidence);
  diagnostics.lane_counts = {
    official: lanes.official.length,
    assistive: lanes.assistive.length,
    contacts: lanes.contacts.length,
    context: lanes.context.length,
  };

  return {
    evidence,
    lanes,
    diagnostics,
  };
}

export function localEvaluateEntries(entries, query, options = {}) {
  const scenarios = parseLifeEventScenariosPayload({ scenarios: options.lifeEventScenarios || [] });
  let context = inferUserStageContext(query, scenarios, options.lifeEventId || null);
  const topicLinks = options.topicLinks instanceof Map
    ? options.topicLinks
    : parseTopicLinksPayload(options.topicLinks || {});
  context = applyTopicLinksToContext(context, topicLinks, query);
  let selectedPack = null;
  if (context.selectedLifeEvent && options.lifeEventResourcePacks) {
    if (options.lifeEventResourcePacks instanceof Map) {
      selectedPack = options.lifeEventResourcePacks.get(context.selectedLifeEvent) || null;
    } else if (Array.isArray(options.lifeEventResourcePacks?.scenarios)) {
      const parsed = parseLifeEventResourcePacksPayload(options.lifeEventResourcePacks);
      selectedPack = parsed.get(context.selectedLifeEvent) || null;
    }
  }
  let candidateEntries = (Array.isArray(entries) ? entries : [])
    .filter((entry) => entry && typeof entry === 'object' && entry.status === 'active')
    .filter((entry) => context.domains.includes(String(entry.domain || '')))
    .filter((entry) => !isLowSignalEntry(entry));
  if (selectedPack) {
    candidateEntries = [
      ...candidateEntries,
      ...buildEntriesFromScenarioPack(selectedPack).filter((entry) => context.domains.includes(String(entry.domain || ''))),
    ];
  }

  const selectedScenario = Array.isArray(context.matchedScenarios)
    ? context.matchedScenarios.find((scenario) => scenario.id === context.selectedLifeEvent) || null
    : null;
  if (selectedScenario) {
    candidateEntries = applyScenarioRelevanceGuard(candidateEntries, selectedScenario);
  } else if (Array.isArray(context.matchedScenarios) && context.matchedScenarios.length === 1) {
    candidateEntries = applyScenarioRelevanceGuard(candidateEntries, context.matchedScenarios[0]);
  }

  const scored = candidateEntries
    .map((entry) => ({
      entry,
      score: scoreEntry(query, entry, context, selectedPack),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
  const ranked = diversifyScoredEntries(dedupeScoredEntriesByUrl(scored), context, 12);

  return {
    stages: context.stageIds,
    domains: context.domains,
    expansions: context.expansions,
    topic_links: context.topicLinks || [],
    weak_topic_links: context.weakTopicLinks || [],
    blocked_topic_links: context.blockedTopicLinks || [],
    first_answer_order: context.firstAnswerOrder || [],
    matched_topic_link_nodes: context.matchedTopicLinkNodes || [],
    scenarios: context.matchedScenarios.map((scenario) => ({
      id: scenario.id,
      label_de: scenario.label_de,
      resource_targets: scenario.resource_targets,
      contact_priority: scenario.contact_priority,
    })),
    results: ranked.map((item) => ({
      id: item.entry.id,
      domain: item.entry.domain,
      title: getLocalizedString(item.entry.title, item.entry.title_de || ''),
      summary: getLocalizedString(item.entry.summary, item.entry.summary_de || ''),
      content: getLocalizedString(item.entry.content, item.entry.content_de || ''),
      url: item.entry.url || '',
      score: item.score,
    })),
  };
}

export function extractiveSynthesisAnswer(evidence) {
  const entries = evidence
    .slice(0, 3)
    .map((item) => {
      const entry = parseJsonSafe(item.content, null);
      if (!entry) return null;
      return {
        entry,
        source: entry.url || item.source || '',
      };
    })
    .filter(Boolean);

  if (entries.length === 0) return null;

  const primary = entries[0].entry;
  const lines = [
    'Wahrscheinlich zuerst relevant:',
    `- ${getLocalizedString(primary.title, primary.title_de || 'Eintrag')}: ${getLocalizedString(primary.summary, primary.summary_de || 'Direkt pruefen.')}`,
  ];
  if (entries[0].source) lines.push(`[Quelle: ${entries[0].source}]`);

  if (entries.length > 1) {
    lines.push('');
    lines.push('Was du jetzt tun kannst:');
    for (const item of entries.slice(1)) {
      const entry = item.entry;
      const title = getLocalizedString(entry.title, entry.title_de || 'Eintrag');
      if (entry.domain === 'tools') {
        lines.push(`- Online starten ueber ${title}.`);
      } else if (entry.domain === 'contacts') {
        lines.push(`- Anlaufstelle finden ueber ${title}.`);
      } else {
        lines.push(`- Danach ${title} pruefen.`);
      }
      if (item.source) lines.push(`[Quelle: ${item.source}]`);
    }
  }

  return lines.join('\n');
}

function compactEvidenceBlock(evidence) {
  const CONTENT_EXCERPT_LEN = 300;
  return evidence
    .slice(0, 5)
    .map((item, index) => {
      const entry = parseJsonSafe(item.content, {});
      const summary = sanitizeText(getLocalizedString(entry.summary, entry.summary_de || ''));
      const contentRaw =
        sanitizeText(getLocalizedString(entry.content, entry.content_de || '')) ||
        sanitizeText(getLocalizedString(entry.summary, entry.summary_de || ''));
      const excerpt = contentRaw.length > CONTENT_EXCERPT_LEN
        ? contentRaw.slice(0, CONTENT_EXCERPT_LEN).replace(/\s+\S*$/, '') + '…'
        : contentRaw;
      const lines = [
        `[${index + 1}] ${getLocalizedString(entry.title, entry.title_de || 'Unbekannt')}`,
        `URL: ${entry.url || 'unknown'}`,
        `Domain: ${entry.domain || 'unknown'}`,
      ];
      if (summary) lines.push(`Zusammenfassung: ${summary}`);
      if (excerpt && excerpt !== summary) lines.push(`Text: ${excerpt}`);
      return lines.join('\n');
    })
    .join('\n\n');
}

function extractCitationUrls(text) {
  return Array.from(String(text || '').matchAll(/\[Quelle:\s*(https?:\/\/[^\]\s]+)\]/gi))
    .map((match) => match[1])
    .filter(Boolean);
}

function splitSimpleSentences(text) {
  return String(text || '')
    .replace(/\[Quelle:\s*https?:\/\/[^\]\s]+\]/gi, '')
    .split(/\n+|(?<=[.!?])\s+/)
    .map((line) => line.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean);
}

function averageWordsPerSentence(text) {
  const sentences = splitSimpleSentences(text);
  if (sentences.length === 0) return 0;
  const words = sentences.reduce((count, sentence) => (
    count + sentence.split(/\s+/).filter(Boolean).length
  ), 0);
  return words / sentences.length;
}

function auditSimpleLanguageAnswer(text, evidence) {
  const normalized = String(text || '').trim();
  const sentences = splitSimpleSentences(normalized);
  const avgWords = averageWordsPerSentence(normalized);
  const citations = new Set(extractCitationUrls(normalized));
  const allowedSources = new Set(
    (Array.isArray(evidence) ? evidence : [])
      .flatMap((item) => {
        const entry = parseJsonSafe(item?.content, {});
        return [item?.source, entry?.url];
      })
      .filter(Boolean)
  );
  const findings = [];

  if (!normalized) findings.push('empty');
  if (sentences.some((sentence) => sentence.split(/\s+/).filter(Boolean).length > 24)) {
    findings.push('long_sentence');
  }
  if (avgWords > 16) findings.push('high_average_sentence_length');
  if (/[;()]/.test(normalized)) findings.push('complex_punctuation');
  if (allowedSources.size > 0 && citations.size === 0) findings.push('missing_citations');
  for (const citation of citations) {
    if (!allowedSources.has(citation)) findings.push('unknown_citation');
  }

  return {
    passed: findings.length === 0,
    findings,
    sentence_count: sentences.length,
    average_words_per_sentence: Number(avgWords.toFixed(2)),
    cited_source_count: citations.size,
  };
}

function firstUsefulSentence(value, fallback = '') {
  const text = sanitizeText(String(value || '')).replace(/\s+/g, ' ').trim();
  if (!text) return fallback;
  const sentence = text.split(/(?<=[.!?])\s+/)[0]?.trim() || text;
  return sentence.length > 180 ? sentence.slice(0, 180).replace(/\s+\S*$/, '') + '.' : sentence;
}

function buildExtractiveSimpleAnswer(query, evidence) {
  const entries = (Array.isArray(evidence) ? evidence : [])
    .slice(0, 4)
    .map((item) => {
      const entry = parseJsonSafe(item.content, null);
      if (!entry) return null;
      return {
        entry,
        source: entry.url || item.source || '',
      };
    })
    .filter(Boolean);

  if (entries.length === 0) return null;

  const normalizedQuery = normalizeGermanChars(String(query || '').toLowerCase());
  const lines = [];
  for (const item of entries.slice(0, 3)) {
    const entry = item.entry;
    const title = getLocalizedString(entry.title, entry.title_de || 'Diese Information');
    const summary = firstUsefulSentence(
      getLocalizedString(entry.summary, entry.summary_de || '') ||
      getLocalizedString(entry.content, entry.content_de || ''),
      'Pruefen Sie diese Information.'
    );
    const normalizedTitle = normalizeGermanChars(title.toLowerCase());

    if (normalizedQuery.includes('wo') && (normalizedQuery.includes('beantrag') || normalizedQuery.includes('antrag'))) {
      if (normalizedTitle.includes('online') || normalizedTitle.includes('beantrag')) {
        lines.push(`- Sie koennen den Antrag hier starten: ${title}.`);
      } else if (normalizedTitle.includes('jobcenter') || entry.domain === 'contacts') {
        lines.push(`- Dort finden Sie die zustaendige Stelle: ${title}.`);
      } else {
        lines.push(`- Wichtig fuer den Antrag: ${title}.`);
      }
    } else if (entry.domain === 'contacts') {
      lines.push(`- Diese Anlaufstelle kann helfen: ${title}.`);
    } else {
      lines.push(`- Pruefen Sie zuerst: ${title}.`);
    }
    if (summary && !summary.toLowerCase().includes(title.toLowerCase())) {
      lines.push(`  ${summary}`);
    }
    if (item.source) lines.push(`[Quelle: ${item.source}]`);
  }

  return lines.join('\n');
}

async function buildPlainLanguageAnswer(env, query, evidence) {
  const simpleEvidence = dedupeEvidence(Array.isArray(evidence) ? evidence : []).slice(0, 10);
  const fallback = buildExtractiveSimpleAnswer(query, simpleEvidence);

  if (!env.AI || simpleEvidence.length === 0) {
    return {
      einfach: fallback,
      source: fallback ? 'fallback' : 'none',
      quality: auditSimpleLanguageAnswer(fallback || '', simpleEvidence),
    };
  }

  try {
    const completion = await runWorkersAiText(env, {
      systemPrompt:
        'Du schreibst Antworten in Einfacher Sprache. ' +
        'Benutze nur die Belege. Erfinde keine Fakten. ' +
        'Schreibe fuer Erwachsene, nicht kindlich. ' +
        'Regeln: kurze Saetze, Alltagssprache, konkrete naechste Schritte. ' +
        'Erklaere Fachwoerter sofort. ' +
        'Jeder Punkt muss vollstaendig sein. ' +
        'Quellen bleiben als eigene Zeile im Format [Quelle: URL].',
      userPrompt:
        `Nutzerfrage:\n${query}\n\nBelege:\n${compactEvidenceBlock(simpleEvidence)}\n\n` +
        'Schreibe eine kurze Antwort in Einfacher Sprache. ' +
        'Beginne mit dem wichtigsten Schritt. ' +
        'Keine Einleitung. Keine neuen Informationen. ' +
        'Maximal 5 Stichpunkte.',
      maxTokens: 700,
      task: 'plain_language',
    });
    const candidate = completion.text || '';
    const quality = auditSimpleLanguageAnswer(candidate, simpleEvidence);
    if (quality.passed) {
      return {
        einfach: candidate,
        source: 'ai-generated',
        quality,
      };
    }

    return {
      einfach: fallback,
      source: fallback ? 'fallback_quality_guard' : 'none',
      quality,
    };
  } catch (error) {
    return {
      einfach: fallback,
      source: fallback ? 'fallback_error' : 'none',
      quality: {
        ...auditSimpleLanguageAnswer(fallback || '', simpleEvidence),
        error: error instanceof Error ? error.message : 'Workers AI request failed.',
      },
    };
  }
}

function buildCuratedEvidenceFromScenarioResources(scenarioResources = []) {
  const items = [];
  const curatedConfidence = (scenarioId, item, baseConfidence) => {
    const title = normalizeGermanChars(String(item?.title || '').toLowerCase());
    const url = canonicalizeUrl(item?.url || '');

    if (scenarioId === 'job_loss_start') {
      if (title.includes('arbeitslos melden') || url.includes('/arbeitslosengeld')) return 0.88;
      if (title.includes('arbeitsagentur und jobcenter') || url.includes('dienststellen')) return 0.8;
      if (
        title.includes('energieschulden') ||
        title.includes('abschaltung') ||
        title.includes('sanktions') ||
        title.includes('wohnungslos') ||
        title.includes('obdachlos') ||
        title.includes('widerspruch') ||
        title.includes('rechtsbehelf')
      ) return 0.42;
      if (title.includes('buergergeld online') || url.includes('buergergeld-beantragen')) return 0.74;
      if (title.includes('antrag und bescheid')) return 0.72;
      if (title.includes('finanziell absichern')) return 0.68;
      if (title.includes('einkommen') && title.includes('ergaenzen')) return 0.46;
      if (title.includes('freiwillige arbeitslosenversicherung')) return 0.4;
    }

    return baseConfidence;
  };
  const pushItems = (list, baseConfidence, scenarioId) => {
    for (const item of list || []) {
      const url = String(item?.url || '').trim();
      if (!url) continue;
      const domain = String(item?.domain || '').trim().toLowerCase() || 'aid';
      const title = String(item?.title || '').trim() || 'Quelle';
      const sourceTier = String(item?.source_tier || '').trim().toLowerCase() || 'tier_2_official';
      const sourceRole =
        sourceTier.startsWith('tier_1_') || sourceTier === 'tier_2_official'
          ? 'official_info'
          : domain === 'contacts'
            ? 'contact_info'
            : domain === 'tools'
              ? 'trusted_tool'
              : 'context_info';
      items.push({
        source: url,
        confidence: curatedConfidence(scenarioId, item, baseConfidence),
        content: JSON.stringify({
          title,
          url,
          domain,
          summary: { de: 'Kuratiert fuer den gewaehlten Lebenskontext.' },
          provenance: {
            source: url,
            sourceTier,
            sourceRole,
          },
        }),
      });
    }
  };
  for (const scenario of Array.isArray(scenarioResources) ? scenarioResources : []) {
    const curated = scenario?.curated_resources || {};
    const scenarioId = String(scenario?.id || '').trim().toLowerCase();
    pushItems(curated.documents, 0.72, scenarioId);
    pushItems(curated.ngo_assistance, 0.74, scenarioId);
    pushItems(curated.contacts, 0.78, scenarioId);
  }
  return dedupeEvidence(items);
}

function buildEntriesFromScenarioPack(scenarioPack) {
  if (!scenarioPack?.resources) return [];
  const resources = scenarioPack.resources;
  const rows = [
    ...(Array.isArray(resources.documents) ? resources.documents : []),
    ...(Array.isArray(resources.ngo_assistance) ? resources.ngo_assistance : []),
    ...(Array.isArray(resources.contacts) ? resources.contacts : []),
  ];
  const seen = new Set();

  return rows
    .map((item) => {
      const url = String(item?.url || '').trim();
      if (!url) return null;
      const key = canonicalizeUrl(url);
      if (!key || seen.has(key)) return null;
      seen.add(key);
      const title = String(item?.title || 'Quelle').trim();
      const normalizedTitle = normalizeGermanChars(title.toLowerCase());
      const summary = normalizedTitle.includes('arbeitslos melden')
        ? 'Melde dich zuerst bei der Agentur für Arbeit arbeitslos und prüfe Arbeitslosengeld. Wenn das nicht reicht oder kein Anspruch besteht, prüfe ergänzend Bürgergeld beim Jobcenter.'
        : normalizedTitle.includes('arbeitsagentur und jobcenter')
          ? 'Finde die zuständige Agentur für Arbeit oder das Jobcenter vor Ort. Dort bekommst du Beratung, Termine und die passende Zuständigkeit.'
          : normalizedTitle.includes('kindergeld-antrag')
            ? 'Beantrage Kindergeld für dein neugeborenes Kind bei der Familienkasse. Der Online-Antrag kann mit Zugangscode oder mit den nötigen Steuerdaten gestartet werden.'
            : normalizedTitle.includes('elterngelddigital')
              ? 'Beantrage Elterngeld online über ElterngeldDigital, wenn dein Bundesland den Dienst unterstützt. Prüfe zusätzlich die zuständige Elterngeldstelle.'
          : `Kuratiert für diesen Lebenskontext: ${title}.`;
      return {
        id: `curated:${key}`,
        title,
        summary: { de: summary },
        content: {
          de: summary,
        },
        url,
        domain: String(item?.domain || 'aid').trim().toLowerCase(),
        status: 'active',
        provenance: {
          source: url,
          sourceTier: String(item?.source_tier || '').trim().toLowerCase(),
          sourceRole: 'life_event_bridge',
        },
        _curatedLifeEventBridge: true,
      };
    })
    .filter(Boolean);
}

function buildAssistiveContacts(evidence, scenarioResources = []) {
  const contacts = [];
  const seen = new Set();
  const nameSignals = Array.from(
    new Set(
      (Array.isArray(scenarioResources) ? scenarioResources : [])
        .flatMap((scenario) => scenario?.contact_priority?.name_keywords || [])
        .filter(Boolean)
    )
  );
  const urlSignals = Array.from(
    new Set(
      (Array.isArray(scenarioResources) ? scenarioResources : [])
        .flatMap((scenario) => scenario?.contact_priority?.url_keywords || [])
        .filter(Boolean)
    )
  );
  const curatedContacts = Array.from(
    new Set(
      (Array.isArray(scenarioResources) ? scenarioResources : [])
        .flatMap((scenario) => scenario?.curated_resources?.contacts || [])
        .map((item) => (item && typeof item === 'object' ? item : null))
        .filter(Boolean)
        .map((item) => JSON.stringify(item))
    )
  ).map((item) => parseJsonSafe(item, null)).filter(Boolean);

  for (const item of evidence) {
    const entry = parseJsonSafe(item.content, {});
    const domain = typeof entry.domain === 'string' ? entry.domain : '';
    const url = typeof entry.url === 'string' ? entry.url : item.source || '';
    if (!url) continue;

    const name = getLocalizedString(entry.title, entry.title_de || '') || 'Kontaktstelle';
    const phone = typeof entry.phone === 'string' ? entry.phone : '';
    const email = typeof entry.email === 'string' ? entry.email : '';
    let scoreBoost = domain === 'contacts' ? 2 : domain === 'aid' ? 1 : 0;
    if (nameSignals.some((token) => name.toLowerCase().includes(token))) scoreBoost += 2;
    if (urlSignals.some((token) => url.toLowerCase().includes(token))) scoreBoost += 2;
    const key = `${name}|${url}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // Prefer explicit contact/aid entries, but keep useful support URLs as fallback.
    if (domain === 'contacts' || domain === 'aid' || /kontakt|beratung|hilfe|hotline|jobcenter|arbeitsagentur/i.test(url)) {
      contacts.push({
        name,
        url,
        phone: phone || null,
        email: email || null,
        source: item.source || url,
        confidence: Math.max(0, Math.min(1, Number(item.confidence || 0))),
        _rank: Number(item.confidence || 0) + scoreBoost,
      });
    }
  }

  for (const item of curatedContacts) {
    const url = String(item.url || '').trim();
    if (!url) continue;
    const name = String(item.title || 'Kontaktstelle').trim();
    const key = `${name}|${url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    contacts.push({
      name,
      url,
      phone: null,
      email: null,
      source: url,
      confidence: 0.75,
      _rank: 6,
    });
  }

  return contacts
    .sort((a, b) => b._rank - a._rank)
    .slice(0, 5)
    .map(({ _rank, ...rest }) => rest);
}

const INSTITUTION_FALLBACK_ROUTES = [
  {
    id: 'stadt_leipzig_sozialamt',
    label: 'Stadt Leipzig',
    url: 'https://www.leipzig.de/',
    keywords: ['sozialamt', 'sozialhilfe', 'sgb xii', 'grundsicherung im alter', 'leipzig'],
    cityKeywords: ['leipzig'],
    note: 'Suche auf der offiziellen Stadtseite nach dem Sozialamt oder der passenden Sozialleistung. Dort findest du die zuständige Stelle, Kontaktwege und aktuelle Öffnungszeiten.',
  },
  {
    id: 'kommune_sozialamt',
    label: 'Stadt- oder Gemeindeverwaltung',
    url: 'https://www.service.bund.de/',
    keywords: ['sozialamt', 'sozialhilfe', 'sgb xii', 'grundsicherung im alter', 'wohngeldstelle', 'buergeramt', 'bürgeramt', 'jugendamt'],
    note: 'Sozialämter und viele andere Behörden sind kommunal organisiert. Suche bei deiner Stadt oder Gemeinde nach der zuständigen Stelle.',
  },
  {
    id: 'arbeitsagentur',
    label: 'Bundesagentur für Arbeit',
    url: 'https://web.arbeitsagentur.de/portal/metasuche/suche/dienststellen',
    keywords: ['arbeitsagentur', 'agentur fuer arbeit', 'agentur für arbeit', 'jobcenter', 'familienkasse', 'dienststelle', 'arbeitsamt', 'biz'],
    note: 'Dort kannst du nach Arbeitsagenturen, Jobcentern, Familienkassen und weiteren Dienststellen vor Ort suchen.',
  },
  {
    id: 'buergergeld',
    label: 'Bundesagentur für Arbeit: Bürgergeld',
    url: 'https://www.arbeitsagentur.de/arbeitslos-arbeit-finden/buergergeld',
    keywords: ['buergergeld', 'bürgergeld', 'grundsicherung', 'aufstockung', 'jobcenter'],
    note: 'Dort findest du Informationen zu Bürgergeld, Antrag, Jobcenter und Kontaktwegen.',
  },
  {
    id: 'krankengeld',
    label: 'Bundesgesundheitsministerium: Krankengeld',
    url: 'https://www.bundesgesundheitsministerium.de/krankengeld',
    keywords: ['krankengeld', 'krank', 'arbeitsunfaehig', 'arbeitsunfähig', 'krankschreibung', 'krankenkasse'],
    note: 'Dort findest du allgemeine Informationen zu Krankengeld und Arbeitsunfähigkeit.',
  },
  {
    id: 'pflege',
    label: 'Bundesgesundheitsministerium: Pflegegeld',
    url: 'https://www.bundesgesundheitsministerium.de/pflegegeld.html',
    keywords: ['pflegegeld', 'pflegegrad', 'pflegebeduerftig', 'pflegebedürftig', 'pflegekasse', 'pflege'],
    note: 'Dort findest du allgemeine Informationen zu Pflegegeld und Pflegebedürftigkeit.',
  },
  {
    id: 'migration',
    label: 'BAMF: Migrationsberatung für Erwachsene',
    url: 'https://www.bamf.de/DE/Themen/Integration/ZugewanderteTeilnehmende/BeratungErwachsene/beratung-erwachsene-node.html',
    keywords: ['migration', 'migrationsberatung', 'integration', 'integrationskurs', 'aufenthalt', 'auslaenderbehoerde', 'ausländerbehörde', 'duldung', 'asyl'],
    note: 'Dort findest du Informationen zur Migrationsberatung und zu wohnortnahen Angeboten.',
  },
  {
    id: 'familie',
    label: 'Familienportal: Kindergeld',
    url: 'https://familienportal.de/familienportal/familienleistungen/kindergeld',
    keywords: ['kindergeld', 'kinderzuschlag', 'elterngeld', 'familienkasse', 'familie'],
    note: 'Dort findest du Informationen zu Familienleistungen und weiteren zuständigen Stellen.',
  },
  {
    id: 'schulden',
    label: 'Verbraucherzentrale: Schuldnerberatung',
    url: 'https://www.verbraucherzentrale.de/geld-versicherungen/kredit-schulden-insolvenz/schuldnerberatung-so-erkennen-sie-gute-angebote-95414',
    keywords: ['schulden', 'schuldnerberatung', 'pfaendung', 'pfändung', 'inkasso', 'insolvenz', 'mietrueckstand', 'mietrückstand'],
    note: 'Dort findest du Hinweise, wie du seriöse Schuldnerberatung erkennst.',
  },
];

function hasLocalLookupIntent(normalizedQuery) {
  return /\b(in meiner stadt|in meiner naehe|in der naehe|vor ort|bei mir|postleitzahl|plz|adresse|dienststelle|wo finde ich|wo ist|wo gibt es|wo bekomme ich)\b/.test(normalizedQuery);
}

function buildInstitutionFallback(query, { evidence = [], strongEvidence = [] } = {}) {
  const normalized = normalizeGermanChars(String(query || '').toLowerCase());
  if (!normalized.trim()) return null;

  const matchedRoutes = INSTITUTION_FALLBACK_ROUTES
    .map((route) => ({
      ...route,
      score: route.keywords.reduce((score, keyword) => {
        const normalizedKeyword = normalizeGermanChars(String(keyword).toLowerCase());
        return normalized.includes(normalizedKeyword) ? score + 1 : score;
      }, 0),
    }))
    .filter((route) => {
      if (route.score <= 0) return false;
      if (!Array.isArray(route.cityKeywords) || route.cityKeywords.length === 0) return true;
      return route.cityKeywords.some((keyword) => normalized.includes(normalizeGermanChars(String(keyword).toLowerCase())));
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (matchedRoutes.length === 0) return null;

  const localIntent = hasLocalLookupIntent(normalized);
  const weakEvidence = evidence.length === 0 || strongEvidence.length === 0;
  if (!localIntent && !weakEvidence) return null;

  const intro = localIntent
    ? 'Dazu haben wir keinen verlässlichen lokalen Treffer im aktuellen Datenbestand.'
    : 'Dazu haben wir gerade keinen ausreichend passenden Eintrag im aktuellen Datenbestand.';
  const routeIntro = matchedRoutes.length === 1
    ? 'Aufgrund deiner Frage passt wahrscheinlich diese Anlaufstelle:'
    : 'Aufgrund deiner Stichwörter passen wahrscheinlich diese Anlaufstellen:';
  const routeLines = matchedRoutes.map((route) =>
    `- ${route.label}: ${route.note}\n[Quelle: ${route.url}]`
  );

  return {
    answer: [intro, routeIntro, ...routeLines].join('\n\n'),
    sources: matchedRoutes.map((route) => route.url),
    routes: matchedRoutes,
  };
}

export function getWorkersAiModel(env, task = 'default') {
  const taskKey = Object.prototype.hasOwnProperty.call(WORKERS_AI_MODEL_ENV_BY_TASK, task)
    ? task
    : 'default';
  const taskEnvName = WORKERS_AI_MODEL_ENV_BY_TASK[taskKey];
  const taskModel = typeof env?.[taskEnvName] === 'string' ? env[taskEnvName].trim() : '';
  const fallbackModel = typeof env?.CF_AI_MODEL === 'string' ? env.CF_AI_MODEL.trim() : '';
  return taskModel || fallbackModel || DEFAULT_MODEL;
}

export function getWorkersAiModelConfig(env) {
  const tasks = {};
  for (const task of Object.keys(WORKERS_AI_MODEL_ENV_BY_TASK)) {
    tasks[task] = {
      env: WORKERS_AI_MODEL_ENV_BY_TASK[task],
      model: getWorkersAiModel(env, task),
      configured: Boolean(String(env?.[WORKERS_AI_MODEL_ENV_BY_TASK[task]] || '').trim()),
    };
  }
  return {
    provider: env?.AI ? 'workers-ai' : 'none',
    configured: Boolean(env?.AI),
    defaultModel: getWorkersAiModel(env),
    tasks,
  };
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

export async function runWorkersAiText(env, { systemPrompt, userPrompt, maxTokens = 160, task = 'default' }) {
  if (!env.AI) {
    throw new Error('Workers AI binding is not configured.');
  }

  const response = await env.AI.run(getWorkersAiModel(env, task), {
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
  const requestUrl = new URL(request.url);
  const hostname = requestUrl.hostname.toLowerCase();
  const isLocalDevHost = hostname === '127.0.0.1' || hostname === 'localhost';
  if (isLocalDevHost) {
    return { configured: Boolean(env.TURNSTILE_SECRET_KEY), success: true, skipped: 'local-dev' };
  }

  // Optional secret-based bypass for short-lived automated E2E checks.
  // This path only activates when TURNSTILE_E2E_BYPASS_TOKEN is configured.
  const bypassToken = request.headers.get('x-e2e-bypass-token');
  const configuredBypassToken = typeof env.TURNSTILE_E2E_BYPASS_TOKEN === 'string'
    ? env.TURNSTILE_E2E_BYPASS_TOKEN.trim()
    : '';
  if (configuredBypassToken && bypassToken === configuredBypassToken) {
    return { configured: Boolean(env.TURNSTILE_SECRET_KEY), success: true, skipped: 'e2e-bypass' };
  }

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
      model: env.AI ? getWorkersAiModel(env, 'rewrite') : 'disabled',
      provider: env.AI ? 'workers-ai' : 'none',
      latency_ms: 0,
      fallback: true,
      explanation: 'Enter a search query to use the guidance assistant.',
    };
  }

  try {
    const completion = await runWorkersAiText(env, {
      systemPrompt:
        'Du optimierst Suchanfragen für ein deutsches Sozialleistungs-Retrieval-System. Gib nur eine kurze deutsche Suchanfrage zurück, die den Recall verbessert, ohne neue Fakten hinzuzufügen.',
      userPrompt: `Ursprüngliche Anfrage:\n${query}\n\nGib nur die optimierte Suchanfrage zurück.`,
      maxTokens: 32,
      task: 'rewrite',
    });
    return {
      rewritten_query: completion.text || query,
      model: getWorkersAiModel(env, 'rewrite'),
      provider: 'workers-ai',
      latency_ms: 0,
      fallback: false,
    };
  } catch (error) {
    return {
      rewritten_query: query,
      model: env.AI ? getWorkersAiModel(env, 'rewrite') : 'disabled',
      provider: env.AI ? 'workers-ai' : 'none',
      latency_ms: 0,
      fallback: true,
      explanation: error instanceof Error ? error.message : 'Workers AI request failed.',
    };
  }
}

export async function buildSynthesis(env, query, evidence, retrievalDiagnostics = null, providedLanes = null) {
  const lanes = providedLanes || splitEvidenceLanes(evidence);
  const scenarioResources = Array.isArray(retrievalDiagnostics?.scenario_resources)
    ? retrievalDiagnostics.scenario_resources
    : [];
  const curatedEvidence = buildCuratedEvidenceFromScenarioResources(scenarioResources);
  const strongEvidence = evidence.filter((item) => Number(item.confidence || 0) >= 0.55);
  const officialStrong = dedupeEvidence([
    ...lanes.official,
    ...curatedEvidence.filter((item) => inferEvidenceMeta(item).domain === 'benefits'),
  ]).filter((item) => Number(item.confidence || 0) >= 0.55);
  const practicalFromOfficial = lanes.official.filter((item) => {
    const meta = inferEvidenceMeta(item);
    return ['aid', 'contacts', 'tools'].includes(meta.domain);
  });
  const assistiveStrong = dedupeEvidence([
    ...lanes.assistive,
    ...practicalFromOfficial,
    ...curatedEvidence.filter((item) => ['aid', 'tools'].includes(inferEvidenceMeta(item).domain)),
  ])
    .filter((item) => Number(item.confidence || 0) >= 0.5)
    .slice(0, 5);
  const contactsStrong = dedupeEvidence([
    ...lanes.contacts,
    ...lanes.assistive.filter((item) => inferEvidenceMeta(item).domain === 'contacts'),
    ...curatedEvidence.filter((item) => inferEvidenceMeta(item).domain === 'contacts'),
  ])
    .filter((item) => Number(item.confidence || 0) >= 0.45)
    .slice(0, 5);
  const attachAnswerQuality = (payload) => {
    const grounding = evaluateAnswerGrounding(payload?.answer || '', evidence, query);
    return {
      ...payload,
      answer_quality: {
        ...grounding,
        answer_shape: auditAnswerShape(query, payload?.answer || '', evidence),
      },
    };
  };
  const institutionFallback = buildInstitutionFallback(query, { evidence, strongEvidence });
  if (institutionFallback) {
    return attachAnswerQuality({
      answer: institutionFallback.answer,
      plain_language: {
        einfach: institutionFallback.answer,
        sources: { einfach: 'fallback' },
        quality: { einfach: auditSimpleLanguageAnswer(institutionFallback.answer, []) },
      },
      explanation: 'Keine genaue Antwort im Datenbestand; passende Anlaufstelle anhand der Anfrage vorgeschlagen.',
      sources: institutionFallback.sources,
      provider: env.AI ? 'workers-ai' : 'none',
      model: env.AI ? getWorkersAiModel(env) : 'router',
      fallback: true,
      evidence,
      evidence_lanes: lanes,
      answer_lanes: {
        official: {
          answer: institutionFallback.answer,
          sources: institutionFallback.sources,
          explanation: null,
        },
        assistive: {
          answer: null,
          sources: [],
          explanation: 'Keine zusätzliche Hilfsquelle vorgeschlagen.',
        },
        contacts: {
          answer: null,
          sources: [],
          explanation: 'Keine konkrete lokale Kontaktstelle im Datenbestand.',
        },
      },
      assistive_contacts: institutionFallback.routes.map((route) => ({
        name: route.label,
        url: route.url,
        phone: null,
        email: null,
        source: route.url,
        confidence: 0.7,
      })),
      weak_evidence: true,
      usage: {},
      retrieval: {
        ...(retrievalDiagnostics || {}),
        fallback_router: institutionFallback.routes.map((route) => route.id),
      },
    });
  }

  async function synthesizeLane(laneName, laneEvidence, systemPromptSuffix) {
    if (laneEvidence.length === 0) {
      return {
        answer: null,
        sources: [],
        explanation:
          laneName === 'official'
            ? 'Keine amtliche Grundlage gefunden.'
            : laneName === 'contacts'
              ? 'Keine direkten Kontaktstellen gefunden.'
              : 'Keine NGO- oder praktische Hilfsquelle gefunden.',
      };
    }
    try {
      const completion = await runWorkersAiText(env, {
        systemPrompt:
          'Du bist ein Retrieval-Assistent für deutsche Sozialleistungen. ' +
          'Benutze nur die bereitgestellten Belege und erfinde keine Fakten. ' +
          'Antworte auf Deutsch. ' +
          systemPromptSuffix,
        userPrompt:
          `Nutzerfrage:\n${query}\n\nBelege:\n${compactEvidenceBlock(laneEvidence)}\n\n` +
          'Antworte mit konkreten Stichpunkten auf Deutsch. Beginne sofort mit dem ersten Stichpunkt, ohne Einleitung und ohne die Anzahl der Stichpunkte anzukündigen. Nenne konkrete nächste Schritte, Adressen oder Leistungen aus den Belegen. Setze Quellen immer als eigene Zeile direkt unter den passenden Stichpunkt im Format [Quelle: URL]. Beende jeden Stichpunkt und jede Quelle vollständig.',
        maxTokens: 650,
        task: 'synthesize',
      });
      return {
        answer: completion.text || extractiveSynthesisAnswer(laneEvidence),
        sources: laneEvidence.map((item) => item.source),
        explanation: null,
      };
    } catch (error) {
      return {
        answer: extractiveSynthesisAnswer(laneEvidence),
        sources: laneEvidence.map((item) => item.source),
        explanation: error instanceof Error ? error.message : 'Workers AI request failed.',
      };
    }
  }

  const officialLane = await synthesizeLane(
    'official',
    officialStrong,
    'Nenne die amtliche Rechtsgrundlage, konkrete Anspruchsvoraussetzungen und den Antragsprozess (Fristen, Formulare, zuständige Stelle). Keine allgemeinen Aussagen – nur was die Belege direkt belegen.'
  );
  const assistiveLane = await synthesizeLane(
    'assistive',
    assistiveStrong,
    'Nenne konkrete NGO-Angebote, Beratungsstellen und praktische nächste Schritte aus den Belegen. Weise darauf hin, dass diese Hinweise unverbindlich sind. Keine Erfindungen.'
  );
  const contactsLane = await synthesizeLane(
    'contacts',
    contactsStrong,
    'Nenne direkte Anlaufstellen mit Name und URL aus den Belegen. Füge Telefonnummern oder Sprechzeiten hinzu, wenn die Belege sie enthalten. Keine allgemeinen Beschreibungen.'
  );
  const assistiveContacts = buildAssistiveContacts([
    ...contactsStrong,
    ...assistiveStrong,
    ...practicalFromOfficial,
    ...lanes.contacts,
    ...lanes.context,
  ], scenarioResources);

  if (evidence.length === 0) {
    return attachAnswerQuality({
      answer: null,
      plain_language: {
        einfach: null,
        sources: { einfach: 'none' },
        quality: { einfach: auditSimpleLanguageAnswer('', []) },
      },
      explanation: 'Keine verlässliche Information gefunden.',
      sources: [],
      provider: env.AI ? 'workers-ai' : 'none',
      model: env.AI ? getWorkersAiModel(env, 'synthesize') : 'disabled',
      fallback: true,
      evidence,
      evidence_lanes: lanes,
      answer_lanes: {
        official: officialLane,
        assistive: assistiveLane,
        contacts: contactsLane,
      },
      assistive_contacts: assistiveContacts,
      weak_evidence: true,
      usage: {},
      retrieval: retrievalDiagnostics,
    });
  }

  const synthesisEvidence = strongEvidence.length > 0 ? strongEvidence : evidence.slice(0, 3);

  try {
    const plainLanguageEvidence = dedupeEvidence([
      ...synthesisEvidence,
      ...contactsStrong,
      ...assistiveStrong,
    ]).slice(0, 10);
    const [completion, plainLanguage] = await Promise.all([
      runWorkersAiText(env, {
        systemPrompt:
          'Du bist ein Retrieval-Assistent für deutsche Sozialleistungen. Benutze nur die bereitgestellten Belege. ' +
          'Wenn die Belege unzureichend sind, sage das klar. Antworte auf Deutsch.',
        userPrompt:
          `Nutzerfrage:\n${query}\n\nBelege:\n${compactEvidenceBlock(synthesisEvidence)}\n\n` +
          'Antworte mit konkreten Stichpunkten auf Deutsch. Beginne sofort mit dem wichtigsten nächsten Schritt, ohne Einleitung und ohne die Anzahl der Stichpunkte anzukündigen. ' +
          'Nenne konkrete Leistungen, Anlaufstellen oder Anträge aus den Belegen. Setze Quellen immer als eigene Zeile direkt unter den passenden Stichpunkt im Format [Quelle: URL]. Beende jeden Stichpunkt und jede Quelle vollständig.',
        maxTokens: 800,
        task: 'synthesize',
      }),
      buildPlainLanguageAnswer(env, query, plainLanguageEvidence),
    ]);
    const standardAnswer =
      completion.text ||
      [
        officialLane.answer ? `Amtliche Grundlage:\n${officialLane.answer}` : '',
        assistiveLane.answer ? `\nNGO-/Praktische Hilfe:\n${assistiveLane.answer}` : '',
        contactsLane.answer ? `\nDirekte Kontakte:\n${contactsLane.answer}` : '',
      ].filter(Boolean).join('\n');
    const answerShape = auditAnswerShape(query, standardAnswer, synthesisEvidence);
    const guardedAnswer = answerShape.passed
      ? standardAnswer
      : buildQuestionFocusedExtractiveAnswer(query, synthesisEvidence) || standardAnswer;
    return attachAnswerQuality({
      answer: guardedAnswer,
      plain_language: {
        einfach: plainLanguage.einfach || null,
        sources: { einfach: plainLanguage.source },
        quality: { einfach: plainLanguage.quality },
      },
      explanation: answerShape.passed
        ? 'Antwort basiert auf abgerufenen Eintraegen.'
        : 'Antwort wurde durch eine fragefokussierte, belegbasierte Fallback-Antwort ersetzt.',
      sources: Array.from(new Set([
        ...officialLane.sources,
        ...assistiveLane.sources,
        ...contactsLane.sources,
        ...synthesisEvidence.map((item) => item.source),
      ])),
      provider: 'workers-ai',
      model: getWorkersAiModel(env, 'synthesize'),
      fallback: !answerShape.passed,
      evidence,
      evidence_lanes: lanes,
      answer_lanes: {
        official: officialLane,
        assistive: assistiveLane,
        contacts: contactsLane,
      },
      assistive_contacts: assistiveContacts,
      weak_evidence: strongEvidence.length === 0,
      answer_guard: answerShape,
      usage: {},
      retrieval: retrievalDiagnostics,
    });
  } catch (error) {
    const fallbackPlainLanguage = await buildPlainLanguageAnswer(env, query, synthesisEvidence);
    return attachAnswerQuality({
      answer: buildQuestionFocusedExtractiveAnswer(query, synthesisEvidence) || extractiveSynthesisAnswer(synthesisEvidence),
      plain_language: {
        einfach: fallbackPlainLanguage.einfach || null,
        sources: { einfach: fallbackPlainLanguage.source },
        quality: { einfach: fallbackPlainLanguage.quality },
      },
      explanation: error instanceof Error ? error.message : 'Workers AI request failed.',
      sources: synthesisEvidence.map((item) => item.source),
      provider: env.AI ? 'workers-ai' : 'none',
      model: env.AI ? getWorkersAiModel(env, 'synthesize') : 'disabled',
      fallback: true,
      evidence,
      evidence_lanes: lanes,
      answer_lanes: {
        official: officialLane,
        assistive: assistiveLane,
        contacts: contactsLane,
      },
      assistive_contacts: assistiveContacts,
      weak_evidence: strongEvidence.length === 0,
      usage: {},
      retrieval: retrievalDiagnostics,
    });
  }
}
