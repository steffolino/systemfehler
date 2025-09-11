import { useI18n } from '#imports'

export type TopicItem = { topic: string; total: number; benefit: number; tool: number; aid: number }

// Fetch topics from /api/topics (benefits/topics)
export async function fetchTopics(limit = 20) {
  const config = useRuntimeConfig();
  const searchBase = config.public.searchBase;
  const url = `${searchBase}/topics?limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch topics');
  return await res.json();
}

export function topicLabel(slug: string) {
  const { t } = useI18n()
  const key = `topics.${slug}`
  const label = t(key)
  return label === key ? slug.replace(/_/g, ' ') : label
}

export const useTopics = async (params = {}) => {
  const config = useRuntimeConfig();
  const searchBase = config.public.searchBase;
  const query = new URLSearchParams(params).toString();
  const url = `${searchBase}/topics${query ? `?${query}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch topics');
  return await res.json();
};
