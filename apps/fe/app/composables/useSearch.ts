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

export async function searchEntries(params: { q?: string; topic?: string; language?: string[]; limit?: number; offset?: number } = {}) {
  const config = useRuntimeConfig();
  const searchBase = config.public.searchBase;
  const url = new URL(searchBase);
  Object.entries(params).forEach(([k, v]) => {
    if (v == null) return
    if (Array.isArray(v)) v.forEach(x => url.searchParams.append(k, String(x)))
    else url.searchParams.set(k, String(v))
  })
  const res = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'systemfehler-frontend/1.0',
      'Accept': 'application/json'
    }
  });
  if (!res.ok) throw new Error(`Search failed: ${res.status}`)
  return await res.json();
}

export async function fetchSearchTopics(params = {}) {
  const config = useRuntimeConfig();
  const searchBase = config.public.searchBase;
  const url = new URL('/topics', searchBase);
  Object.entries(params).forEach(([k, v]) => {
    if (v == null) return
    if (Array.isArray(v)) v.forEach(x => url.searchParams.append(k, String(x)))
    else url.searchParams.set(k, String(v))
  })
  const res = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'systemfehler-frontend/1.0',
      'Accept': 'application/json'
    }
  });
  if (!res.ok) throw new Error('Failed to fetch topics');
  return await res.json();
}

export async function suggest(prefix: string, topic?: string) {
  const config = useRuntimeConfig();
  const searchBase = config.public.searchBase;
  const url = new URL('/suggest', searchBase);
  url.searchParams.set('prefix', prefix)
  if (topic) url.searchParams.set('topic', topic)
  const res = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'systemfehler-frontend/1.0',
      'Accept': 'application/json'
    }
  });
  if (!res.ok) throw new Error(`Suggest failed: ${res.status}`)
  return await res.json();
}
