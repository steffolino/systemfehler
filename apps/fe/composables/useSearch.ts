import { ref } from 'vue';
import { getJson } from '../lib/api';
import type { CategoryEnum, StatusEnum, LanguageCode } from '../types/systemfehler.schema';

export interface SearchParams {
  q?: string;
  category?: CategoryEnum;
  status?: StatusEnum;
  topic?: string;
  lang?: LanguageCode;
  limit?: number;
}

interface SearchResult {
  kind: string;
  id: string;
  [key: string]: unknown;
}

export function useSearch(params: SearchParams) {
  const results = ref<SearchResult[]>([]);
  const pending = ref(false);
  const error = ref<string | null>(null);

  async function search() {
    pending.value = true;
    error.value = null;
    try {
      // URLSearchParams erwartet string values, daher umwandeln
      const query = new URLSearchParams(
        Object.fromEntries(
          Object.entries(params).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => [k, String(v)])
        )
      ).toString();
      // API liefert jetzt { results, count }
      const data = await getJson<{ results: SearchResult[]; count: number }>(`/search?${query}`);
      results.value = Array.isArray(data?.results) ? data.results : [];
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      pending.value = false;
    }
  }

  search();

  return { results, pending, error };
}
