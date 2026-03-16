function applyPlainLanguageReview(translations, { mode, action, reviewer = null, now = new Date().toISOString() }) {
  const keys =
    mode === 'einfach'
      ? { reviewed: 'de-EINFACH', suggested: 'de-EINFACH-SUGGESTED' }
      : mode === 'leicht'
        ? { reviewed: 'de-LEICHT', suggested: 'de-LEICHT-SUGGESTED' }
        : null;

  if (!keys) {
    throw new Error(`Unsupported plain-language mode: ${mode}`);
  }
  if (!['approve', 'reject'].includes(action)) {
    throw new Error(`Unsupported plain-language action: ${action}`);
  }

  const nextTranslations = { ...(translations || {}) };
  const suggested = nextTranslations[keys.suggested];
  const reviewed = nextTranslations[keys.reviewed];
  const sourceRecord = suggested || reviewed;

  if (!sourceRecord || typeof sourceRecord !== 'object') {
    throw new Error(`No ${mode} plain-language translation available`);
  }

  if (action === 'approve') {
    const approvedRecord = {
      ...sourceRecord,
      reviewed: true,
      variant: mode,
      reviewStatus: 'approved',
      reviewedBy: reviewer || sourceRecord.reviewedBy || undefined,
      reviewedAt: now,
      timestamp: now,
    };
    nextTranslations[keys.reviewed] = approvedRecord;
    if (suggested) {
      nextTranslations[keys.suggested] = {
        ...suggested,
        variant: mode,
        reviewStatus: 'approved',
        reviewed: true,
        reviewedBy: reviewer || suggested.reviewedBy || undefined,
        reviewedAt: now,
      };
    }
    return nextTranslations;
  }

  if (suggested) {
    nextTranslations[keys.suggested] = {
      ...suggested,
      variant: mode,
      reviewStatus: 'rejected',
      reviewed: false,
      reviewedBy: reviewer || suggested.reviewedBy || undefined,
      reviewedAt: now,
    };
  }

  return nextTranslations;
}

export async function onRequest(context) {
  const { request, params, env } = context;
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'content-type': 'application/json' },
    });
  }

  try {
    const { id } = params;
    const payload = await request.json();
    const mode = payload?.mode;
    const action = payload?.action;
    const reviewer = typeof payload?.reviewer === 'string' ? payload.reviewer.trim() : null;

    const db = env.DB;
    const row = await db
      .prepare('SELECT id, domain, url, status, title_de, updated_at, translations, entry_json FROM entries WHERE id = ?')
      .bind(id)
      .first();

    if (!row) {
      return new Response(JSON.stringify({ error: 'Entry not found' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      });
    }

    const translations = row.translations ? JSON.parse(row.translations) : {};
    const updatedTranslations = applyPlainLanguageReview(translations, { mode, action, reviewer });
    const entryJson = row.entry_json ? JSON.parse(row.entry_json) : {};
    entryJson.translations = updatedTranslations;

    const updatedAt = new Date().toISOString();
    await db
      .prepare('UPDATE entries SET translations = ?, entry_json = ?, updated_at = ? WHERE id = ?')
      .bind(JSON.stringify(updatedTranslations), JSON.stringify(entryJson), updatedAt, id)
      .run();

    entryJson.id = row.id;
    entryJson.domain = row.domain;
    entryJson.url = row.url;
    entryJson.status = row.status;
    entryJson.title_de = row.title_de;
    entryJson.updated_at = updatedAt;

    return new Response(JSON.stringify({ entry: entryJson, mode, action }), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: 'Failed to update plain-language review',
        message: err && err.message,
      }),
      {
        status: 400,
        headers: { 'content-type': 'application/json' },
      }
    );
  }
}
