export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const domain = url.searchParams.get('domain');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);
  const includeTranslations = url.searchParams.get('includeTranslations') === 'true' || url.searchParams.get('includeTranslations') === '1';

  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const base = path.resolve(process.cwd(), 'data');

    let entries = [];

    if (domain) {
      const file = path.join(base, domain, 'entries.json');
      const txt = await fs.readFile(file, 'utf8').catch(() => '[]');
      const arr = JSON.parse(txt || '[]');
      entries = Array.isArray(arr) ? arr : [];
    } else {
      // read all domain folders under data
      const dirs = await fs.readdir(base, { withFileTypes: true }).catch(() => []);
      for (const d of dirs) {
        if (!d.isDirectory()) continue;
        const file = path.join(base, d.name, 'entries.json');
        const txt = await fs.readFile(file, 'utf8').catch(() => null);
        if (!txt) continue;
        const arr = JSON.parse(txt || '[]');
        if (Array.isArray(arr)) {
          // attach domain field if missing
          arr.forEach(e => { if (e && !e.domain) e.domain = d.name; });
          entries.push(...arr);
        }
      }
    }

    // optionally attach translations (already present in snapshots)
    if (!includeTranslations) {
      // ensure we don't send huge translations objects accidentally
      entries = entries.map(e => {
        const copy = { ...e };
        if (copy.translations) delete copy.translations;
        return copy;
      });
    }

    const total = entries.length;
    const page = Math.floor(offset / limit) + 1;
    const pageItems = entries.slice(offset, offset + limit);

    return new Response(JSON.stringify({ entries: pageItems, total, limit, offset, page, pages: Math.ceil(total / limit) }), {
      headers: { 'content-type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to read entries', message: err && err.message }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
}
