/**
 * API Client for Systemfehler Backend
 */

import type {
  DbMultilingualText as MultilingualText,
  DbProvenance as Provenance,
  DbTranslationRecord as TranslationRecord,
  DbTranslationsMap as TranslationsMap,
  DbQualityScores as QualityScores,
  domain_type as DomainType,
  entry_status as EntryStatus,
  moderation_action as ModerationAction,
  moderation_status as ModerationStatus,
  entries as DbEntryRow,
  moderationQueue as DbModerationQueueRow,
} from './db_types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://systemfehler-api-worker.inequality.workers.dev/api';
const AI_API_BASE_URL = import.meta.env.VITE_AI_API_URL || 'http://localhost:8002';
const DEFAULT_SNAPSHOT_BASE_URL =
  typeof window !== 'undefined'
    ? `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}`
    : import.meta.env.BASE_URL.replace(/\/$/, '');
const SNAPSHOT_BASE_URL =
  import.meta.env.VITE_SNAPSHOT_BASE_URL ||
  DEFAULT_SNAPSHOT_BASE_URL;
const IS_GITHUB_PAGES =
  typeof window !== 'undefined' && window.location.hostname.endsWith('github.io');
const DOMAINS = ['benefits', 'aid', 'tools', 'organizations', 'contacts'] as const;

interface HealthResponse {
  status: string;
  timestamp: string;
  database: string;
}

interface StatusResponse {
  database: {
    totalEntries: number;
    byDomain: Record<string, Record<string, number>>;
  };
  moderation: Record<string, number>;
  qualityScores: {
    avgIqs: string;
    avgAis: string;
  };
  timestamp: string;
}

type EntryTitle = string | MultilingualText;
type JsonRecord = Record<string, unknown>;

function isJsonRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

type Entry = Omit<
  DbEntryRow,
  | 'domain'
  | 'status'
  | 'provenance'
  | 'translations'
  | 'quality_scores'
  | 'target_groups'
  | 'title_de'
  | 'title_en'
  | 'title_easy_de'
  | 'summary_de'
  | 'summary_en'
  | 'summary_easy_de'
  | 'content_de'
  | 'content_en'
  | 'content_easy_de'
> & {
  id: string;
  domain: DomainType | string;
  title?: EntryTitle;
  summary?: MultilingualText;
  content?: MultilingualText;
  url: string;
  topics?: string[];
  tags?: string[];
  targetGroups?: string[];
  target_groups?: string[];
  status: EntryStatus | string;
  validFrom?: string;
  validUntil?: string;
  deadline?: string;
  firstSeen?: string;
  first_seen?: string;
  lastSeen?: string;
  last_seen?: string;
  sourceUnavailable?: boolean;
  source_unavailable?: boolean;
  provenance?: Provenance | null;
  qualityScores?: QualityScores | null;
  quality_scores?: QualityScores | null;
  iqs?: number | null;
  ais?: number | null;
  translations?: TranslationsMap | null;
  translationLanguages?: string[];
  title_de?: string | null;
  title_en?: string | null;
  title_easy_de?: string | null;
  summary_de?: string | null;
  summary_en?: string | null;
  summary_easy_de?: string | null;
  content_de?: string | null;
  content_en?: string | null;
  content_easy_de?: string | null;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
};

interface EntriesResponse {
  entries: Entry[];
  total: number;
  limit: number;
  offset: number;
  page: number;
  pages: number;
}

type ModerationQueueEntry = Omit<
  DbModerationQueueRow,
  'domain' | 'action' | 'status' | 'provenance' | 'candidate_data' | 'existing_data' | 'reviewed_by' | 'reviewed_at'
> & {
  id: string;
  entryId?: string;
  entry_id?: string;
  domain: DomainType | string;
  action: ModerationAction | string;
  status: ModerationStatus | string;
  candidateData?: JsonRecord | null;
  candidate_data?: JsonRecord | null;
  existingData?: JsonRecord | null;
  existing_data?: JsonRecord | null;
  diff?: JsonRecord | null;
  diffSummary?: {
    type?: string;
    addedCount?: number;
    modifiedCount?: number;
    removedCount?: number;
    unchangedCount?: number;
    totalChanges?: number;
  };
  importantChanges?: string[];
  provenance?: Provenance | null;
  reviewedBy?: string | null;
  reviewed_by?: string | null;
  reviewedAt?: string | null;
  reviewed_at?: string | null;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  title?: EntryTitle;
  title_de?: string | null;
  url?: string;
};

interface ModerationQueueResponse {
  queue: ModerationQueueEntry[];
  total: number;
  status: string;
  domain?: string;
}

interface QualityReportResponse {
  byDomain: Record<string, {
    totalEntries: number;
    activeEntries: number;
    avgIqs: string;
    avgAis: string;
    missingEnTranslation: number;
    missingEasyDeTranslation: number;
  }>;
  lowQualityEntries: Array<{
    id: string;
    domain: string;
    title: string;
    url: string;
    iqs: number;
    ais: number;
  }>;
  missingTranslations: Array<{
    id: string;
    domain: string;
    title: string;
    url: string;
    missingEn: boolean;
    missingEasyDe: boolean;
  }>;
}

interface AIRewriteResponse {
  rewritten_query: string;
  model: string;
  provider: string;
  latency_ms: number;
  fallback: boolean;
  explanation?: string | null;
}

interface AIEvidence {
  source: string;
  content: string;
  confidence: number;
}

interface AIRetrieveResponse {
  evidence: AIEvidence[];
  weak_evidence?: boolean;
  latency_ms: number;
}

interface AISynthesizeResponse {
  answer: string | null;
  explanation: string;
  sources: string[];
  provider: string;
  model: string;
  latency_ms: number;
  fallback: boolean;
  evidence: AIEvidence[];
  weak_evidence?: boolean;
  usage?: Record<string, unknown>;
}

interface AIResultBundle {
  rewrite: AIRewriteResponse;
  synthesis: AISynthesizeResponse;
  relatedEntries: Entry[];
}

interface AIHealthResponse {
  status: string;
  provider: {
    provider: string;
    configured: boolean;
    status?: string;
    models?: string[];
    error?: string;
  };
  host: string;
  port: number;
}

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const normalizedBase = API_BASE_URL.replace(/\/+$/, '');
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const dedupedEndpoint =
    normalizedBase.endsWith('/api') && normalizedEndpoint.startsWith('/api/')
      ? normalizedEndpoint.slice(4)
      : normalizedEndpoint;
  const url = `${normalizedBase}${dedupedEndpoint}`;
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      // Try to parse JSON error, fall back to text
      let errorMsg = 'API request failed';
      try {
        const errJson = await response.json();
        if (isJsonRecord(errJson)) {
          const recordError = typeof errJson.error === 'string' ? errJson.error : null;
          const recordMessage = typeof errJson.message === 'string' ? errJson.message : null;
          errorMsg = recordError || recordMessage || JSON.stringify(errJson);
        } else {
          errorMsg = JSON.stringify(errJson);
        }
      } catch {
        try {
          errorMsg = await response.text();
        } catch {
          errorMsg = 'API request failed';
        }
      }
      throw new Error(errorMsg);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Unknown error occurred');
  }
}

async function fetchSnapshot<T>(path: string): Promise<T> {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${SNAPSHOT_BASE_URL}${normalizedPath}`;
  const response = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
  if (!response.ok) {
    throw new Error(`Snapshot request failed (${response.status}): ${path}`);
  }
  return (await response.json()) as T;
}

async function fetchAiApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const normalizedBase = AI_API_BASE_URL.replace(/\/+$/, '');
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${normalizedBase}${normalizedEndpoint}`;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 45000);

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
  } catch (error) {
    window.clearTimeout(timeout);
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('AI request timed out after 45 seconds');
    }
    throw error;
  }
  window.clearTimeout(timeout);

  if (!response.ok) {
    let errorMsg = `AI request failed (${response.status})`;
    try {
      const payload = await response.json();
      errorMsg = JSON.stringify(payload);
    } catch {
      try {
        errorMsg = await response.text();
      } catch {
        errorMsg = `AI request failed (${response.status})`;
      }
    }
    throw new Error(errorMsg);
  }

  return (await response.json()) as T;
}

function buildAiTimeoutRewrite(query: string, message: string): AIRewriteResponse {
  return {
    rewritten_query: query,
    model: 'timeout',
    provider: 'unknown',
    latency_ms: 45000,
    fallback: true,
    explanation: message,
  };
}

function buildAiTimeoutSynthesis(message: string): AISynthesizeResponse {
  return {
    answer: null,
    explanation: message,
    sources: [],
    provider: 'unknown',
    model: 'timeout',
    latency_ms: 45000,
    fallback: true,
    evidence: [],
    weak_evidence: true,
  };
}

function parseEvidenceEntries(evidence: AIEvidence[]): Entry[] {
  const relatedEntriesMap = new Map<string, Entry>();
  for (const item of evidence || []) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(item.content);
    } catch {
      continue;
    }

    const normalized = normalizeEntriesPayload([parsed]);
    for (const entry of normalized) {
      if (!relatedEntriesMap.has(entry.id)) {
        relatedEntriesMap.set(entry.id, entry);
      }
    }
  }

  return Array.from(relatedEntriesMap.values());
}

function getLocalizedTitle(value: EntryTitle | undefined, fallback?: string | null, locale: keyof MultilingualText = 'de'): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const localized = value[locale];
    if (typeof localized === 'string') return localized;
    if (typeof value.de === 'string') return value.de;
    if (typeof value.en === 'string') return value.en;
  }
  return fallback || '';
}

function getTranslationTitle(translations: TranslationsMap | null | undefined, key: string): string | null {
  const record = translations?.[key];
  return record?.title ?? null;
}

export function getEntryTitleText(entry: Pick<Entry, 'title' | 'title_de' | 'title_en'>, locale: keyof MultilingualText = 'de'): string {
  return getLocalizedTitle(entry.title, locale === 'en' ? entry.title_en ?? entry.title_de ?? '' : entry.title_de, locale);
}

function normalizeEntriesPayload(payload: unknown, domainFallback?: string): Entry[] {
  const payloadRecord = isJsonRecord(payload) ? payload : null;
  const list: unknown[] = Array.isArray(payload)
    ? payload
    : payloadRecord && Array.isArray(payloadRecord.entries)
    ? payloadRecord.entries
    : [];

  return list
    .filter((entry: unknown): entry is JsonRecord => isJsonRecord(entry))
    .filter(
      (entry): entry is JsonRecord & Pick<Entry, 'id' | 'url' | 'status'> =>
        typeof entry.id === 'string' &&
        typeof entry.url === 'string' &&
        typeof entry.status === 'string'
    )
    .map((entry): Entry => ({
      ...(entry as Partial<Entry>),
      domain: typeof entry.domain === 'string' ? entry.domain : domainFallback || 'unknown',
      id: entry.id,
      url: entry.url,
      status: entry.status,
    }));
}

async function loadSnapshotEntries(domain?: string): Promise<Entry[]> {
  if (domain) {
    const payload = await fetchSnapshot<unknown>(`/data/${domain}/entries.json`);
    return normalizeEntriesPayload(payload, domain);
  }

  const allEntries = await Promise.all(
    DOMAINS.map(async (currentDomain) => {
      const payload = await fetchSnapshot<unknown>(`/data/${currentDomain}/entries.json`).catch(() => []);
      return normalizeEntriesPayload(payload, currentDomain);
    })
  );

  return allEntries.flat();
}

function filterEntries(entries: Entry[], params?: {
  status?: string;
  search?: string;
  includeTranslations?: boolean;
}): Entry[] {
  let filtered = [...entries];

  if (params?.status) {
    filtered = filtered.filter((entry) => entry.status === params.status);
  }

  if (params?.search) {
    const needle = params.search.toLowerCase();
    filtered = filtered.filter((entry) => {
      const title = getLocalizedTitle(entry.title, entry.title_de).toLowerCase();
      const summary = entry.summary?.de || entry.summary_de || '';
      const url = entry.url || '';
      return (
        title.includes(needle) ||
        summary.toLowerCase().includes(needle) ||
        url.toLowerCase().includes(needle)
      );
    });
  }

  if (!params?.includeTranslations) {
    filtered = filtered.map((entry) => {
      const { translations, ...clone } = entry;
      void translations;
      return clone;
    });
  }

  return filtered;
}

async function getEntriesFromSnapshots(params?: {
  domain?: string;
  status?: string;
  limit?: number;
  offset?: number;
  search?: string;
  includeTranslations?: boolean;
}): Promise<EntriesResponse> {
  const limit = Math.min(params?.limit ?? 50, 100);
  const offset = Math.max(params?.offset ?? 0, 0);

  const entries = await loadSnapshotEntries(params?.domain);
  const filtered = filterEntries(entries, params);

  const total = filtered.length;
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.max(1, Math.ceil(total / limit));
  const paged = filtered.slice(offset, offset + limit);

  return {
    entries: paged,
    total,
    limit,
    offset,
    page,
    pages,
  };
}

async function getModerationQueueFromSnapshots(params?: {
  status?: string;
  domain?: string;
  limit?: number;
  offset?: number;
}): Promise<ModerationQueueResponse> {
  const limit = Math.min(params?.limit ?? 100, 100);
  const offset = Math.max(params?.offset ?? 0, 0);
  const payload = await fetchSnapshot<unknown>('/moderation/review_queue.json').catch(() => []);
  const payloadRecord = isJsonRecord(payload) ? payload : null;
  const list: unknown[] = Array.isArray(payload)
    ? payload
    : payloadRecord && Array.isArray(payloadRecord.queue)
    ? payloadRecord.queue
    : [];

  let queue = list.filter(
    (item: unknown): item is ModerationQueueEntry => Boolean(item && typeof item === 'object')
  );

  if (params?.status) {
    queue = queue.filter((item: ModerationQueueEntry) => (item.status || 'pending') === params.status);
  }
  if (params?.domain) {
    queue = queue.filter((item: ModerationQueueEntry) => item.domain === params.domain);
  }

  const paged = queue.slice(offset, offset + limit);
  return {
    queue: paged,
    total: queue.length,
    status: params?.status || 'pending',
    domain: params?.domain,
  };
}

async function getQualityReportFromSnapshots(): Promise<QualityReportResponse> {
  const entries = await loadSnapshotEntries();
  const byDomain: QualityReportResponse['byDomain'] = {};

  for (const domain of DOMAINS) {
    const domainEntries = entries.filter((entry) => entry.domain === domain);
    const activeEntries = domainEntries.filter((entry) => entry.status === 'active');
    const totalEntries = domainEntries.length;
    const avgIqs =
      totalEntries > 0
        ? domainEntries.reduce((acc, entry) => acc + Number(entry.iqs ?? entry.qualityScores?.iqs ?? 0), 0) / totalEntries
        : 0;
    const avgAis =
      totalEntries > 0
        ? domainEntries.reduce((acc, entry) => acc + Number(entry.ais ?? entry.qualityScores?.ais ?? 0), 0) / totalEntries
        : 0;
    const missingEnTranslation = domainEntries.filter(
      (entry) =>
        !(typeof entry.title === 'object' && entry.title?.en) &&
        !entry.title_en &&
        !getTranslationTitle(entry.translations, 'en')
    ).length;
    const missingEasyDeTranslation = domainEntries.filter(
      (entry) =>
        !(typeof entry.title === 'object' && entry.title?.easy_de) &&
        !entry.title_easy_de &&
        !getTranslationTitle(entry.translations, 'de-LEICHT')
    ).length;

    byDomain[domain] = {
      totalEntries,
      activeEntries: activeEntries.length,
      avgIqs: avgIqs.toFixed(2),
      avgAis: avgAis.toFixed(2),
      missingEnTranslation,
      missingEasyDeTranslation,
    };
  }

  const lowQualityEntries = entries
    .filter((entry) => Number(entry.iqs ?? entry.qualityScores?.iqs ?? 0) < 50 || Number(entry.ais ?? entry.qualityScores?.ais ?? 0) < 50)
    .map((entry) => ({
      id: entry.id,
      domain: entry.domain,
      title: getLocalizedTitle(entry.title, entry.title_de) || 'Untitled',
      url: entry.url,
      iqs: Number(entry.iqs ?? entry.qualityScores?.iqs ?? 0),
      ais: Number(entry.ais ?? entry.qualityScores?.ais ?? 0),
    }));

  const missingTranslations = entries
    .map((entry) => {
      const missingEn =
        !(typeof entry.title === 'object' && entry.title?.en) &&
        !entry.title_en &&
        !getTranslationTitle(entry.translations, 'en');
      const missingEasyDe =
        !(typeof entry.title === 'object' && entry.title?.easy_de) &&
        !entry.title_easy_de &&
        !getTranslationTitle(entry.translations, 'de-LEICHT');
      return {
        id: entry.id,
        domain: entry.domain,
        title: getLocalizedTitle(entry.title, entry.title_de) || 'Untitled',
        url: entry.url,
        missingEn,
        missingEasyDe,
      };
    })
    .filter((entry) => entry.missingEn || entry.missingEasyDe);

  return {
    byDomain,
    lowQualityEntries,
    missingTranslations,
  };
}

export const api = {
  getHealth: async (): Promise<HealthResponse> => {
    if (IS_GITHUB_PAGES) {
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: 'snapshot',
      };
    }
    return fetchApi<HealthResponse>('/api/health');
  },

  getStatus: async (): Promise<StatusResponse> => {
    if (IS_GITHUB_PAGES) {
      const entriesResponse = await getEntriesFromSnapshots({ includeTranslations: true, limit: 100, offset: 0 });
      const queue = await getModerationQueueFromSnapshots({ status: 'pending', limit: 100, offset: 0 });
      const byDomain = entriesResponse.entries.reduce<Record<string, Record<string, number>>>((acc, entry) => {
        if (!acc[entry.domain]) {
          acc[entry.domain] = { total: 0, active: 0 };
        }
        acc[entry.domain].total += 1;
        if (entry.status === 'active') {
          acc[entry.domain].active += 1;
        }
        return acc;
      }, {});
      const avgIqs =
        entriesResponse.entries.length > 0
          ? (
              entriesResponse.entries.reduce(
                (sum, entry) => sum + Number(entry.iqs ?? entry.qualityScores?.iqs ?? 0),
                0
              ) / entriesResponse.entries.length
            ).toFixed(2)
          : '0.00';
      const avgAis =
        entriesResponse.entries.length > 0
          ? (
              entriesResponse.entries.reduce(
                (sum, entry) => sum + Number(entry.ais ?? entry.qualityScores?.ais ?? 0),
                0
              ) / entriesResponse.entries.length
            ).toFixed(2)
          : '0.00';

      return {
        database: {
          totalEntries: entriesResponse.total,
          byDomain,
        },
        moderation: {
          pending: queue.total,
        },
        qualityScores: {
          avgIqs,
          avgAis,
        },
        timestamp: new Date().toISOString(),
      };
    }
    return fetchApi<StatusResponse>('/api/status');
  },

  getEntries: async (params?: {
    domain?: string;
    status?: string;
    limit?: number;
    offset?: number;
    search?: string;
    includeTranslations?: boolean;
  }): Promise<EntriesResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.domain) queryParams.append('domain', params.domain);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());
    if (params?.search) queryParams.append('search', params.search);
    if (params?.includeTranslations) queryParams.append('includeTranslations', 'true');

    if (IS_GITHUB_PAGES) {
      return getEntriesFromSnapshots(params);
    }

    try {
      return await fetchApi<EntriesResponse>(`/api/data/entries?${queryParams.toString()}`);
    } catch (error) {
      if (IS_GITHUB_PAGES) {
        return getEntriesFromSnapshots(params);
      }
      throw error;
    }
  },

  getEntry: async (id: string): Promise<{ entry: Entry }> => {
    if (IS_GITHUB_PAGES) {
      const entries = await getEntriesFromSnapshots({ includeTranslations: true, limit: 1000, offset: 0 });
      const entry = entries.entries.find((item) => item.id === id);
      if (!entry) {
        throw new Error('Entry not found');
      }
      return { entry };
    }
    return fetchApi<{ entry: Entry }>(`/api/data/entries/${id}`);
  },

  getModerationQueue: async (params?: {
    status?: string;
    domain?: string;
    limit?: number;
    offset?: number;
  }): Promise<ModerationQueueResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    if (params?.domain) queryParams.append('domain', params.domain);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());

    if (IS_GITHUB_PAGES) {
      return getModerationQueueFromSnapshots(params);
    }

    try {
      return await fetchApi<ModerationQueueResponse>(`/api/data/moderation-queue?${queryParams.toString()}`);
    } catch (error) {
      if (IS_GITHUB_PAGES) {
        return getModerationQueueFromSnapshots(params);
      }
      throw error;
    }
  },

  getQualityReport: async (): Promise<QualityReportResponse> => {
    if (IS_GITHUB_PAGES) {
      return getQualityReportFromSnapshots();
    }

    try {
      return await fetchApi<QualityReportResponse>('/api/data/quality-report');
    } catch (error) {
      if (IS_GITHUB_PAGES) {
        return getQualityReportFromSnapshots();
      }
      throw error;
    }
  },

  getAIResults: async (query: string): Promise<AIResultBundle> => {
    const trimmed = query.trim();
    if (!trimmed) {
      return {
        rewrite: {
          rewritten_query: '',
          model: 'disabled',
          provider: 'none',
          latency_ms: 0,
          fallback: true,
          explanation: 'Enter a search query to use the AI assistant.',
        },
        synthesis: {
          answer: null,
          explanation: 'Enter a search query to use the AI assistant.',
          sources: [],
          provider: 'none',
          model: 'disabled',
          latency_ms: 0,
          fallback: true,
          evidence: [],
          weak_evidence: true,
        },
        relatedEntries: [],
      };
    }

    if (IS_GITHUB_PAGES) {
      return {
        rewrite: {
          rewritten_query: trimmed,
          model: 'disabled',
          provider: 'none',
          latency_ms: 0,
          fallback: true,
          explanation: 'AI sidecar is not available on GitHub Pages.',
        },
        synthesis: {
          answer: null,
          explanation: 'AI sidecar is not available on GitHub Pages.',
          sources: [],
          provider: 'none',
          model: 'disabled',
          latency_ms: 0,
          fallback: true,
          evidence: [],
          weak_evidence: true,
        },
        relatedEntries: [],
      };
    }

    const [rewriteResult, retrieveResult, synthesisResult] = await Promise.allSettled([
      fetchAiApi<AIRewriteResponse>('/rewrite', {
        method: 'POST',
        body: JSON.stringify({ query: trimmed }),
      }),
      fetchAiApi<AIRetrieveResponse>('/retrieve', {
        method: 'POST',
        body: JSON.stringify({ query: trimmed }),
      }),
      fetchAiApi<AISynthesizeResponse>('/synthesize', {
        method: 'POST',
        body: JSON.stringify({ query: trimmed }),
      }),
    ]);

    const rewrite =
      rewriteResult.status === 'fulfilled'
        ? rewriteResult.value
        : buildAiTimeoutRewrite(trimmed, rewriteResult.reason instanceof Error ? rewriteResult.reason.message : 'AI rewrite failed');

    const synthesis =
      synthesisResult.status === 'fulfilled'
        ? synthesisResult.value
        : buildAiTimeoutSynthesis(
            synthesisResult.reason instanceof Error ? synthesisResult.reason.message : 'AI synthesis failed'
          );
    const retrievalEvidence =
      retrieveResult.status === 'fulfilled'
        ? retrieveResult.value.evidence
        : synthesis.evidence || [];
    const relatedEntries = parseEvidenceEntries(retrievalEvidence);
    const finalSynthesis =
      retrieveResult.status === 'fulfilled'
        ? {
            ...synthesis,
            evidence: retrievalEvidence,
            weak_evidence: synthesis.weak_evidence ?? retrieveResult.value.weak_evidence,
          }
        : synthesis;

    return {
      rewrite,
      synthesis: finalSynthesis,
      relatedEntries,
    };
  },

  getAIHealth: async (): Promise<AIHealthResponse> => {
    if (IS_GITHUB_PAGES) {
      return {
        status: 'unavailable',
        provider: {
          provider: 'none',
          configured: false,
          status: 'disabled',
        },
        host: 'github-pages',
        port: 0,
      };
    }

    try {
      return await fetchAiApi<AIHealthResponse>('/health');
    } catch {
      return {
        status: 'unreachable',
        provider: {
          provider: 'none',
          configured: false,
          status: 'unreachable',
          error: 'AI sidecar is not reachable at the configured URL.',
        },
        host: AI_API_BASE_URL,
        port: 0,
      };
    }
  },

  autocomplete: async ({ query, limit = 10 }: { query: string; limit?: number }) => {
    if (!query || query.length < 1) return [];
    const res = await api.getEntries({ search: query, limit });
    const needle = query.toLowerCase();
    return (res.entries || [])
      .filter(e => {
        const rawTitle = getLocalizedTitle(e.title, e.title_de);
        const title = typeof rawTitle === 'string' ? rawTitle : '';
        const lower = title.toLowerCase();
        return lower.includes(needle);
      })
      .map(e => ({
        id: e.id,
        title: getLocalizedTitle(e.title, e.title_de),
        category: e.domain || ''
      }));
  },
};

export type {
  HealthResponse,
  StatusResponse,
  Entry,
  EntriesResponse,
  ModerationQueueEntry,
  ModerationQueueResponse,
  QualityReportResponse,
  MultilingualText,
  TranslationsMap,
  TranslationRecord,
  Provenance,
  AIRewriteResponse,
  AISynthesizeResponse,
  AIResultBundle,
  AIHealthResponse,
};
