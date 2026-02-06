/**
 * API Client for Systemfehler Backend
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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

export const api = {
  getHealth: async (): Promise<HealthResponse> => {
    return fetchApi<HealthResponse>('/api/health');
  },

  getStatus: async (): Promise<StatusResponse> => {
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

    return fetchApi<EntriesResponse>(`/api/data/entries?${queryParams.toString()}`);
  },

  getEntry: async (id: string): Promise<{ entry: Entry }> => {
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

    return fetchApi<ModerationQueueResponse>(`/api/data/moderation-queue?${queryParams.toString()}`);
  },

  getQualityReport: async (): Promise<QualityReportResponse> => {
    return fetchApi<QualityReportResponse>('/api/data/quality-report');
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
