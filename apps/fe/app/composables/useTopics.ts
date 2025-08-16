import { useI18n } from '#imports'

export type TopicItem = { topic: string; total: number; benefit: number; tool: number; aid: number }

const SEARCH_BASE = (import.meta as any).env?.VITE_SEARCH_BASE || 'http://localhost:8000'

export async function fetchTopics(limit = 20) {
  const url = new URL('/topics', SEARCH_BASE)
  url.searchParams.set('limit', String(limit))
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`Topics failed: ${res.status}`)
  return (await res.json()) as { topics: TopicItem[] }
}

export function topicLabel(slug: string) {
  const { t } = useI18n()
  const key = `topics.${slug}`
  const label = t(key)
  return label === key ? slug.replace(/_/g, ' ') : label
}
