import { ref } from 'vue';
import { getJson } from '../lib/api';

export function useTopics() {
  const topics = ref<string[]>([]);
  const pending = ref(false);
  const error = ref<string | null>(null);

  async function fetchTopics() {
    pending.value = true;
    error.value = null;
    try {
      topics.value = await getJson<string[]>('/topics');
    } catch (e: any) {
      error.value = e.message;
    } finally {
      pending.value = false;
    }
  }

  fetchTopics();

  return { topics, pending, error };
}
