// Cloudflare Workers API handler using D1 (Cloudflare's SQLite-compatible DB).

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const { pathname } = url

    // Add this for debugging
    console.log("Request path:", pathname, "Method:", request.method);

    // /api/benefits
    if (pathname === '/api/benefits' && request.method === 'GET') {
      const { results } = await env.DB.prepare("SELECT * FROM benefits").all()
      return new Response(JSON.stringify(results), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const benefitMatch = pathname.match(/^\/api\/benefits\/(\w+)$/)
    if (benefitMatch && request.method === 'GET') {
      const id = benefitMatch[1]
      const { results } = await env.DB.prepare("SELECT * FROM benefits WHERE id = ?").bind(id).all()
      if (results.length === 0) {
        return new Response(JSON.stringify({ error: 'not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      return new Response(JSON.stringify(results[0]), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // /api/tools
    if (pathname === '/api/tools' && request.method === 'GET') {
      const { results } = await env.DB.prepare("SELECT * FROM tools").all()
      return new Response(JSON.stringify(results), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // /api/slogans
    if (pathname === '/api/slogans' && request.method === 'GET') {
      const { results } = await env.DB.prepare("SELECT * FROM slogans").all()
      return new Response(JSON.stringify(results), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // /admin/refresh-search (not supported in Workers)
    if (pathname === '/admin/refresh-search' && request.method === 'POST') {
      return new Response(JSON.stringify({ ok: false, error: 'Not implemented on Workers' }), {
        status: 501,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Upsert benefit (admin)
    if (
      pathname === '/admin/upsert-benefit' ||
      pathname === '/api/admin/upsert-benefit' ||
      pathname === '/services/api/admin/upsert-benefit'
    ) {
      if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: "Method Not Allowed" }), { status: 405 })
      }
      let benefit
      try {
        benefit = await request.json()
      } catch (e) {
        return new Response(JSON.stringify({ ok: false, error: "Invalid JSON" }), { status: 400 })
      }
      // Validate required fields
      const required = ["id", "url", "title", "meta_description", "h1", "excerpt", "content", "source", "language", "status", "last_crawled_at"]
      for (const key of required) {
        if (!(key in benefit)) {
          return new Response(JSON.stringify({ ok: false, error: `Missing field: ${key}` }), { status: 400 })
        }
      }
      // Store language as JSON string if it's an array
      const language = Array.isArray(benefit.language) ? JSON.stringify(benefit.language) : benefit.language
      const topic = Array.isArray(benefit.topic) || benefit.topic === null
        ? JSON.stringify(benefit.topic)
        : JSON.stringify([benefit.topic])
      // Upsert (insert or replace)
      await env.DB.prepare(`
        INSERT INTO benefits (
          id, url, title, meta_description, h1, excerpt, content, topic, source, language, status, last_crawled_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          url=excluded.url,
          title=excluded.title,
          meta_description=excluded.meta_description,
          h1=excluded.h1,
          excerpt=excluded.excerpt,
          content=excluded.content,
          topic=excluded.topic,
          source=excluded.source,
          language=excluded.language,
          status=excluded.status,
          last_crawled_at=excluded.last_crawled_at
      `)
      .bind(
        benefit.id, benefit.url, benefit.title, benefit.meta_description, benefit.h1, benefit.excerpt,
        benefit.content, topic, benefit.source, language, benefit.status, benefit.last_crawled_at
      ).run()
      return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } })
    }

    // Optional: Bulk import all (POST /admin/import-all with JSON array)
    if (pathname === '/admin/import-all' && request.method === 'POST') {
      let benefits
      try {
        benefits = await request.json()
      } catch (e) {
        return new Response(JSON.stringify({ ok: false, error: "Invalid JSON" }), { status: 400 })
      }
      let count = 0
      for (const benefit of benefits) {
        const required = ["id", "url", "title", "meta_description", "h1", "excerpt", "content", "source", "language", "status", "last_crawled_at"]
        if (!required.every(k => k in benefit)) continue
        const language = Array.isArray(benefit.language) ? JSON.stringify(benefit.language) : benefit.language
        const topic = Array.isArray(benefit.topic) || benefit.topic === null
          ? JSON.stringify(benefit.topic)
          : JSON.stringify([benefit.topic])
        await env.DB.prepare(`
          INSERT INTO benefits (
            id, url, title, meta_description, h1, excerpt, content, topic, source, language, status, last_crawled_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            url=excluded.url,
            title=excluded.title,
            meta_description=excluded.meta_description,
            h1=excluded.h1,
            excerpt=excluded.excerpt,
            content=excluded.content,
            topic=excluded.topic,
            source=excluded.source,
            language=excluded.language,
            status=excluded.status,
            last_crawled_at=excluded.last_crawled_at
        `)
        .bind(
          benefit.id, benefit.url, benefit.title, benefit.meta_description, benefit.h1, benefit.excerpt,
          benefit.content, topic, benefit.source, language, benefit.status, benefit.last_crawled_at
        ).run()
        count++
      }
      return new Response(JSON.stringify({ ok: true, count }), { headers: { "Content-Type": "application/json" } })
    }

    // Health check endpoint
    if (pathname === '/health' && request.method === 'GET') {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // 404 fallback
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}