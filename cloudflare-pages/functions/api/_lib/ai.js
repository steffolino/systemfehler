const DEFAULT_MODEL = '@cf/meta/llama-3.1-8b-instruct';
const DEFAULT_RATE_LIMIT_WINDOW_SECONDS = 60;
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
  'matomo',
  'mit der einwilligung',
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
  'Ã¼bersicht der internetseite',
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
  'mit', 'ohne', 'fuer', 'fÃ¼r', 'auf', 'bei', 'von', 'zu', 'im', 'in', 'am', 'an',
  'was', 'wie', 'wo', 'wer', 'wann', 'warum', 'wieso', 'weshalb',
  'nun', 'jetzt', 'heute', 'morgen', 'gestern',
  'bitte', 'danke', 'hallo',
]);
const LIFE_EVENT_TOPICS_ASSET_PATH = '/data/_topics/life_events.json';
const LIFE_EVENT_RESOURCE_PACKS_ASSET_PATH = '/data/_topics/life_event_resource_packs.json';
const LIFE_EVENT_CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_GUIDED_DOMAINS = ['benefits', 'aid', 'contacts', 'tools'];
let lifeEventScenarioCache = {
  loadedAt: 0,
  scenarios: [],
};
let lifeEventResourcePackCache = {
  loadedAt: 0,
  packsById: new Map(),
};
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

export function listLifeEventScenarios(scenarios) {
  return (Array.isArray(scenarios) ? scenarios : []).map((scenario) => ({
    id: scenario.id,
    label_de: scenario.label_de || scenario.id,
    label_en: scenario.label_en || scenario.label_de || scenario.id,
    domains: scenario.domains,
    resource_targets: scenario.resource_targets,
  }));
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

function scoreEntry(query, entry, context = null, scenarioPack = null) {
  const q = normalizeGermanChars((query || '').toLowerCase());
  const text = entryTextBlob(entry);
  const normalizedText = normalizeGermanChars(text);
  const title = getLocalizedString(entry.title, entry.title_de || '').toLowerCase();
  const url = canonicalizeUrl(entry.url || '');
  const contextExpansions = Array.isArray(context?.expansions) ? context.expansions : [];
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

  if (q.includes('kontakt') || q.includes('telefon') || q.includes('erreichen')) {
    if (entry.domain === 'contacts') score += 5;
  }

  if (q.includes('hilfe') || q.includes('unterstuetz') || q.includes('unterstÃ¼tz')) {
    if (entry.domain === 'aid') score += 4;
    if (entry.domain === 'contacts') score += 3.5;
    if (entry.domain === 'benefits') score += 2.5;
    if (entry.domain === 'tools') score += 1.5;
  }

  if (q.includes('online') || q.includes('antrag') || q.includes('beantrag')) {
    if (entry.domain === 'tools') score += 3;
    if (text.includes('eservices')) score += 3;
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

  return score;
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

function inferUserStageContext(query, scenarios, forcedLifeEventId = null) {
  const q = normalizeGermanChars(String(query || '').toLowerCase());
  const list = Array.isArray(scenarios) ? scenarios : [];
  const matchedRules = list.filter((rule) =>
    rule.keywords.some((keyword) => q.includes(keyword))
  );
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
    };
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
    stageIds: effectiveRules.map((rule) => rule.id),
    expansions,
    domains: domains.length > 0 ? domains : guidedSearchDomains(query),
    selectedLifeEvent: forcedScenario ? forcedScenario.id : null,
    matchedScenarios: effectiveRules,
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

function diversifyScoredEntries(scoredEntries, context, limit = 12) {
  const sorted = [...(Array.isArray(scoredEntries) ? scoredEntries : [])]
    .sort((a, b) => b.score - a.score);
  if (sorted.length <= 1) return sorted.slice(0, limit);

  const selected = [];
  const used = new Set();
  const targetDomains = Array.from(
    new Set(
      (Array.isArray(context?.matchedScenarios) ? context.matchedScenarios : [])
        .flatMap((scenario) => scenario.domains || [])
    )
  ).slice(0, 4);

  // Keep the single best-scoring hit at rank 1.
  selected.push(sorted[0]);
  used.add(0);

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

  const context = inferUserStageContext(
    query,
    options.lifeEventScenarios || [],
    options.lifeEventId || null
  );
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
  const resourcePacks = await loadLifeEventResourcePacks(env, {
    requestUrl: options.requestUrl || null,
  });
  const stageContext = inferUserStageContext(query, scenarios, options.lifeEventId || null);
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
    stage_domains: stageContext.domains,
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

  const keywordEvidence = await retrieveKeywordEvidence(env, query, {
    lifeEventId: options.lifeEventId || null,
    lifeEventScenarios: scenarios,
    scenarioPack: selectedPack,
  });
  let combinedEvidence = keywordEvidence;

  if (config.activeMode === 'hybrid' || config.activeMode === 'external') {
    const externalResult = await retrieveExternalEvidence(env, query, MAX_EXTERNAL_EVIDENCE);
    diagnostics.external_status = externalResult.status;

    if (externalResult.status === 'ok') {
      combinedEvidence = config.activeMode === 'external'
        ? externalResult.evidence
        : dedupeEvidence([...externalResult.evidence, ...keywordEvidence]);
    } else if (config.activeMode === 'external') {
      diagnostics.fallback = true;
      diagnostics.retrieval_mode = 'keyword';
      combinedEvidence = keywordEvidence;
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
  const context = inferUserStageContext(query, scenarios, options.lifeEventId || null);
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
  const ranked = diversifyScoredEntries(scored, context, 12);

  return {
    stages: context.stageIds,
    domains: context.domains,
    expansions: context.expansions,
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
      url: item.entry.url || '',
      score: item.score,
    })),
  };
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

function buildCuratedEvidenceFromScenarioResources(scenarioResources = []) {
  const items = [];
  const pushItems = (list, confidence) => {
    for (const item of list || []) {
      const url = String(item?.url || '').trim();
      if (!url) continue;
      const domain = String(item?.domain || '').trim().toLowerCase() || 'aid';
      const title = String(item?.title || '').trim() || 'Quelle';
      items.push({
        source: url,
        confidence,
        content: JSON.stringify({
          title,
          url,
          domain,
          summary: { de: 'Kuratiert fuer den gewaehlten Lebenskontext.' },
          provenance: {
            source: url,
            sourceTier: String(item?.source_tier || '').trim().toLowerCase() || 'tier_2_official',
            sourceRole: domain === 'contacts' ? 'contact_info' : 'context_info',
          },
        }),
      });
    }
  };
  for (const scenario of Array.isArray(scenarioResources) ? scenarioResources : []) {
    const curated = scenario?.curated_resources || {};
    pushItems(curated.documents, 0.72);
    pushItems(curated.ngo_assistance, 0.74);
    pushItems(curated.contacts, 0.78);
  }
  return dedupeEvidence(items);
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
  const requestUrl = new URL(request.url);
  const hostname = requestUrl.hostname.toLowerCase();
  const isLocalDevHost = hostname === '127.0.0.1' || hostname === 'localhost';
  if (isLocalDevHost) {
    return { configured: Boolean(env.TURNSTILE_SECRET_KEY), success: true, skipped: 'local-dev' };
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
      model: env.AI ? getWorkersAiModel(env) : 'disabled',
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
          'Antworte mit 2–4 konkreten Stichpunkten auf Deutsch. Nenne konkrete nächste Schritte, Adressen oder Leistungen aus den Belegen. Zitiere URLs als [Quelle: URL]. Beende jeden Stichpunkt vollständig.',
        maxTokens: 320,
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
    return {
      answer: null,
      explanation: 'Keine verlaessliche Information gefunden.',
      sources: [],
      provider: env.AI ? 'workers-ai' : 'none',
      model: env.AI ? getWorkersAiModel(env) : 'disabled',
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
    };
  }

  const synthesisEvidence = strongEvidence.length > 0 ? strongEvidence : evidence.slice(0, 3);

  try {
    const [completion, einfachCompletion] = await Promise.all([
      runWorkersAiText(env, {
        systemPrompt:
          'Du bist ein Retrieval-Assistent für deutsche Sozialleistungen. Benutze nur die bereitgestellten Belege. ' +
          'Wenn die Belege unzureichend sind, sage das klar. Antworte auf Deutsch.',
        userPrompt:
          `Nutzerfrage:\n${query}\n\nBelege:\n${compactEvidenceBlock(synthesisEvidence)}\n\n` +
          'Antworte mit 2–4 konkreten Stichpunkten auf Deutsch. Beginne mit dem wichtigsten nächsten Schritt. ' +
          'Nenne konkrete Leistungen, Anlaufstellen oder Anträge aus den Belegen. Zitiere URLs als [Quelle: URL]. Beende jeden Stichpunkt vollständig.',
        maxTokens: 350,
      }),
      (async () => {
        // Einfach gets a richer evidence pool that always includes contacts + assistive
        const einfachEvidence = dedupeEvidence([
          ...synthesisEvidence,
          ...contactsStrong,
          ...assistiveStrong,
        ]).slice(0, 10);
        return runWorkersAiText(env, {
          systemPrompt:
            'Du schreibst Informationen über Sozialleistungen in Einfacher Sprache. ' +
            'Regeln: Kurze Sätze – maximal 10 Wörter pro Satz. ' +
            'Fachbegriffe sofort einfach erklären. ' +
            'Jeden Stichpunkt vollständig beenden. ' +
            'Keine doppelten Themen – jeder Stichpunkt behandelt etwas anderes. ' +
            'Gib konkrete Leistungen mit Beträgen, konkrete nächste Schritte und Anlaufstellen mit URL aus den Belegen an. ' +
            'Erfinde keine Informationen. Benutze nur die Belege. ' +
            'Beginne SOFORT mit dem ersten Stichpunkt. Kein einleitender Satz davor.',
          userPrompt:
            `Nutzerfrage:\n${query}\n\nBelege:\n${compactEvidenceBlock(einfachEvidence)}\n\n` +
            'Schreibe 4–6 Stichpunkte auf Deutsch. Kurze Sätze. Jeder Punkt ein anderes Thema. Nenne konkrete Leistungen, nächste Schritte und Anlaufstellen mit URL. Zitiere URLs als [Quelle: URL].',
          maxTokens: 450,
        });
      })(),
    ]);
    const standardAnswer =
      completion.text ||
      [
        officialLane.answer ? `Amtliche Grundlage:\n${officialLane.answer}` : '',
        assistiveLane.answer ? `\nNGO-/Praktische Hilfe:\n${assistiveLane.answer}` : '',
        contactsLane.answer ? `\nDirekte Kontakte:\n${contactsLane.answer}` : '',
      ].filter(Boolean).join('\n');
    return {
      answer: standardAnswer,
      plain_language: {
        einfach: einfachCompletion.text || null,
        sources: { einfach: einfachCompletion.text ? 'ai-generated' : 'fallback' },
      },
      explanation: 'Antwort basiert auf abgerufenen Eintraegen.',
      sources: Array.from(new Set([
        ...officialLane.sources,
        ...assistiveLane.sources,
        ...contactsLane.sources,
        ...synthesisEvidence.map((item) => item.source),
      ])),
      provider: 'workers-ai',
      model: getWorkersAiModel(env),
      fallback: false,
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
    };
  } catch (error) {
    return {
      answer: extractiveSynthesisAnswer(synthesisEvidence),
      explanation: error instanceof Error ? error.message : 'Workers AI request failed.',
      sources: synthesisEvidence.map((item) => item.source),
      provider: env.AI ? 'workers-ai' : 'none',
      model: env.AI ? getWorkersAiModel(env) : 'disabled',
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
    };
  }
}


