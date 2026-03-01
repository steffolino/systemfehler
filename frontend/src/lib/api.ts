/**
 * API Client for Systemfehler Backend
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
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

interface MultilingualText {
  de?: string;
  en?: string;
  easy_de?: string;
  [key: string]: string | undefined;
}

interface Provenance {
  source: string;
  crawlId?: string;
  checksum?: string;
  crawledAt: string;
  method?: string;
  generator?: string;
  [key: string]: string | undefined;
}

interface TranslationRecord {
  title?: string;
  summary?: string;
  body?: string;
  provenance?: Provenance;
  method?: 'llm' | 'rule' | 'human' | 'mt';
  generator?: string;
  timestamp: string;
  reviewed?: boolean;
}

type TranslationsMap = Record<string, TranslationRecord>;

interface QualityScores {
  iqs?: number;
  ais?: number;
  computedAt?: string;
  [key: string]: number | string | undefined;
}

interface Entry {
  id: string;
  domain: string;
  title?: MultilingualText;
  summary?: MultilingualText;
  content?: MultilingualText;
  url: string;
  topics?: string[];
  tags?: string[];
  targetGroups?: string[];
  target_groups?: string[];
  status: string;
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
}

interface EntriesResponse {
  entries: Entry[];
  total: number;
  limit: number;
  offset: number;
  page: number;
  pages: number;
}

interface ModerationQueueEntry {
  id: string;
  entryId?: string;
  entry_id?: string;
  domain: string;
  action: string;
  status: string;
  candidateData?: any;
  candidate_data?: any;
  existingData?: any;
  existing_data?: any;
  diff?: any;
  provenance?: any;
  reviewedBy?: string | null;
  reviewed_by?: string | null;
  reviewedAt?: string | null;
  reviewed_at?: string | null;
  createdAt?: string;
  created_at?: string;
  title?: MultilingualText;
  title_de?: string | null;
  url?: string;
}

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

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
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
        errorMsg = errJson.error || errJson.message || JSON.stringify(errJson);
      } catch (e) {
        try { errorMsg = await response.text(); } catch (_) {}
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

function normalizeEntriesPayload(payload: unknown, domainFallback?: string): Entry[] {
  const list: unknown[] = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object' && Array.isArray((payload as any).entries)
    ? (payload as any).entries
    : [];

  return list
    .filter((entry: unknown): entry is Record<string, any> => Boolean(entry && typeof entry === 'object'))
    .map((entry: Record<string, any>) => ({ ...entry, domain: entry.domain || domainFallback || 'unknown' })) as Entry[];
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
      const title = entry.title?.de || entry.title_de || '';
      const summary = entry.summary?.de || entry.summary_de || '';
      const url = entry.url || '';
      return (
        title.toLowerCase().includes(needle) ||
        summary.toLowerCase().includes(needle) ||
        url.toLowerCase().includes(needle)
      );
    });
  }

  if (!params?.includeTranslations) {
    filtered = filtered.map((entry) => {
      const clone = { ...entry };
      if ('translations' in clone) {
        delete (clone as any).translations;
      }
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
  const list: unknown[] = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object' && Array.isArray((payload as any).queue)
    ? (payload as any).queue
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
      (entry) => !entry.title?.en && !entry.title_en && !(entry.translations && entry.translations.en)
    ).length;
    const missingEasyDeTranslation = domainEntries.filter(
      (entry) => !entry.title?.easy_de && !entry.title_easy_de && !(entry.translations && entry.translations['de-LEICHT'])
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
      title: entry.title?.de || entry.title_de || 'Untitled',
      url: entry.url,
      iqs: Number(entry.iqs ?? entry.qualityScores?.iqs ?? 0),
      ais: Number(entry.ais ?? entry.qualityScores?.ais ?? 0),
    }));

  const missingTranslations = entries
    .map((entry) => {
      const missingEn = !entry.title?.en && !entry.title_en && !(entry.translations && entry.translations.en);
      const missingEasyDe = !entry.title?.easy_de && !entry.title_easy_de && !(entry.translations && entry.translations['de-LEICHT']);
      return {
        id: entry.id,
        domain: entry.domain,
        title: entry.title?.de || entry.title_de || 'Untitled',
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
};
