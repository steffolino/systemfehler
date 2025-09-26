import { IRequest } from 'itty-router'

export async function healthHandler(request: IRequest, env: any) {
  try {
    await env.DB.prepare('SELECT 1').first()
    return new Response('ok', { status: 200 })
  } catch (e) {
    return new Response('db error', { status: 500 })
  }
}

export async function searchHandler(request: IRequest, env: any) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q') || ''
  const lang = searchParams.get('lang')
  const topic = searchParams.get('topic')
  const type = searchParams.get('type')
  const sort = searchParams.get('sort') || 'relevance'
  const page = parseInt(searchParams.get('page') || '1')
  const size = parseInt(searchParams.get('size') || '10')
  const offset = (page - 1) * size
  let orderBy = 'score ASC'
  if (sort === 'date_desc') orderBy = 's.updatedAt DESC'
  if (sort === 'date_asc') orderBy = 's.updatedAt ASC'
  const sql = `
    SELECT s.id, s.type, s.url, s.language, s.topic, s.title, s.summary, s.updatedAt,
           bm25(search_doc_fts) AS score
    FROM search_doc_fts
    JOIN search_doc s ON s.rowid = search_doc_fts.rowid
    WHERE search_doc_fts MATCH ?
      AND (? IS NULL OR s.language = ?)
      AND (? IS NULL OR s.topic = ?)
      AND (? IS NULL OR s.type = ?)
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `
  const params = [q, lang, lang, topic, topic, type, type, size, offset]
  const results = await env.DB.prepare(sql).bind(...params).all()
  return Response.json({ results: results.results })
}

export async function detailHandler(request: IRequest, env: any) {
  const id = request.params.id
  const sql = 'SELECT * FROM aid_offer WHERE id = ?'
  const result = await env.DB.prepare(sql).bind(id).first()
  if (!result) return new Response('Not found', { status: 404 })
  return Response.json(result)
}

export async function sourcesHandler(request: IRequest, env: any) {
  const sql = 'SELECT * FROM crawl_source WHERE active = 1'
  const results = await env.DB.prepare(sql).all()
  return Response.json({ sources: results.results })
}
