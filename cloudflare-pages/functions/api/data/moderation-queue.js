export async function onRequest(context) {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const filePath = path.resolve(process.cwd(), 'moderation', 'review_queue.json');
    const txt = await fs.readFile(filePath, 'utf8').catch(() => '[]');
    const arr = JSON.parse(txt || '[]');
    const mapped = Array.isArray(arr) ? arr.map(it => ({
      id: it.id || null,
      entry_id: it.entry_id || it.entryId || null,
      domain: it.domain || null,
      status: it.status || 'pending',
      candidate_data: it.translation_text ? { translation: it.translation_text } : it.candidate_data || null,
      provenance: it.provenance || { source: it.source || null },
      title_de: it.title_de || null,
      url: it.source || it.url || null,
      original_text: it.original_text || null,
      translation_text: it.translation_text || null,
      method: it.method || null,
      generator: it.generator || null,
      timestamp: it.timestamp || null,
      created_at: it.created_at || it.timestamp || null
    })) : [];

    return new Response(JSON.stringify({ queue: mapped, total: mapped.length }), { headers: { 'content-type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to read moderation queue', message: err && err.message }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
}
