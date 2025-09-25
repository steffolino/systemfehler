import { ref } from 'vue';
import { getJson } from '../lib/api';
import type { CategoryEnum, StatusEnum, LanguageCode } from '../types/systemfehler.schema';

interface SearchParams {
  q?: string;
  category?: CategoryEnum;
  status?: StatusEnum;
  topic?: string;
  lang?: LanguageCode;
  limit?: number;
}

export function useSearch(params: SearchParams) {
  const results = ref<any[]>([]);
  const pending = ref(false);
  const error = ref<string | null>(null);

  async function search() {
    pending.value = true;
    error.value = null;
    try {
      const query = new URLSearchParams(params as any).toString();
      // Try SearchEntryList, fallback to array of Entity
      try {
        results.value = await getJson<any[]>(`/search?${query}`, '#/$defs/SearchEntryList');
      } catch {
        results.value = await getJson<any[]>(`/search?${query}`, '#/$defs/Entity');
      }
    } catch (e: any) {
      error.value = e.message;
    } finally {
      pending.value = false;
    }
  }

  search();

  return { results, pending, error };
}
