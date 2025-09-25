import { ref } from 'vue';
import { getJson } from '../lib/api';
import type { Entity, LanguageCode } from '../types/systemfehler.schema';

interface EntityParams {
  id: string;
  lang?: LanguageCode;
}

export function useEntity(params: EntityParams) {
  const entity = ref<Entity | null>(null);
  const pending = ref(false);
  const error = ref<string | null>(null);

  async function fetchEntity() {
    pending.value = true;
    error.value = null;
    try {
      const query = params.lang ? `?lang=${params.lang}` : '';
      try {
        entity.value = await getJson<Entity>(`/entities/${params.id}${query}`, '#/$defs/EntityDetail');
      } catch {
        entity.value = await getJson<Entity>(`/entities/${params.id}${query}`, '#/$defs/Entity');
      }
    } catch (e: any) {
      error.value = e.message;
    } finally {
      pending.value = false;
    }
  }

  fetchEntity();

  return { entity, pending, error };
}
