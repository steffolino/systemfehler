export async function onRequest(context) {
  const { params } = context;
  const id = params.id;
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const base = path.resolve(process.cwd(), 'data');

    const dirs = await fs.readdir(base, { withFileTypes: true }).catch(() => []);
    for (const d of dirs) {
      if (!d.isDirectory()) continue;
      const file = path.join(base, d.name, 'entries.json');
      const txt = await fs.readFile(file, 'utf8').catch(() => null);
      if (!txt) continue;
      const arr = JSON.parse(txt || '[]');
      if (!Array.isArray(arr)) continue;
      const found = arr.find(e => e && e.id === id);
      if (found) {
        if (!found.domain) found.domain = d.name;
        return new Response(JSON.stringify({ entry: found }), { headers: { 'content-type': 'application/json' } });
      }
    }

    return new Response(JSON.stringify({ error: 'Entry not found' }), { status: 404, headers: { 'content-type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to read entry', message: err && err.message }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
}
