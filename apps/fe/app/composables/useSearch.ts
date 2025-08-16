export type Hit = {
  kind: 'benefit'|'tool'|'aid'
  id: string
  topic: string[]
  language: string[]
  title_de: string
  title_en?: string
  summary_de?: string
  summary_en?: string
  source_domain?: string
  updated_at: string
  score: number
}

const BASE = (import.meta as any).env?.VITE_SEARCH_BASE || 'http://localhost:8000'

export async function searchEntries(params: { q?: string; topic?: string; language?: string[]; limit?: number; offset?: number } = {}) {
  const url = new URL('/search', BASE)
  Object.entries(params).forEach(([k, v]) => {
    if (v == null) return
    if (Array.isArray(v)) v.forEach(x => url.searchParams.append(k, String(x)))
    else url.searchParams.set(k, String(v))
  })
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`Search failed: ${res.status}`)
  return await res.json() as { hits: Hit[] }
}

export async function suggest(prefix: string, topic?: string) {
  const url = new URL('/suggest', BASE)
  url.searchParams.set('prefix', prefix)
  if (topic) url.searchParams.set('topic', topic)
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`Suggest failed: ${res.status}`)
  return await res.json() as { suggestions: { kind:string; id:string; title:string }[] }
}
