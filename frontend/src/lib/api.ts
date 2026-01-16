/**
 * API Client for Systemfehler Backend
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface ApiError {
  error: string;
  message?: string;
}

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

interface Entry {
  id: string;
  domain: string;
  title_de?: string;
  title_en?: string;
  title_easy_de?: string;
  summary_de?: string;
  summary_en?: string;
  content_de?: string;
  url: string;
  topics?: string[];
  tags?: string[];
  target_groups?: string[];
  status: string;
  first_seen?: string;
  last_seen?: string;
  provenance?: any;
  quality_scores?: any;
  iqs?: number;
  ais?: number;
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
  entry_id?: string;
  domain: string;
  action: string;
  status: string;
  candidate_data: any;
  existing_data?: any;
  diff?: any;
  provenance?: any;
  created_at: string;
  title_de?: string;
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
      const error: ApiError = await response.json();
      throw new Error(error.error || error.message || 'API request failed');
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
  }): Promise<EntriesResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.domain) queryParams.append('domain', params.domain);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());
    if (params?.search) queryParams.append('search', params.search);

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
};
