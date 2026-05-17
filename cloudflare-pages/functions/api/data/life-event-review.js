import { clampPositiveInt, jsonResponse, optionsResponse, readJsonBody } from '../_lib/http.js';

const TABLE_SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS life_event_review_cases (
    id TEXT PRIMARY KEY,
    query TEXT NOT NULL,
    normalized_query TEXT NOT NULL,
    detected_stages TEXT,
    selected_life_event TEXT,
    editorial_review_reasons TEXT,
    occurrence_count INTEGER NOT NULL DEFAULT 1,
    first_seen TEXT NOT NULL,
    last_seen TEXT NOT NULL,
    resolved_status TEXT NOT NULL DEFAULT 'open',
    resolution_notes TEXT,
    resolved_by TEXT,
    resolved_at TEXT
  )`,
  'CREATE INDEX IF NOT EXISTS idx_life_event_review_cases_status ON life_event_review_cases(resolved_status, last_seen DESC)',
  'CREATE INDEX IF NOT EXISTS idx_life_event_review_cases_last_seen ON life_event_review_cases(last_seen DESC)',
  `CREATE TABLE IF NOT EXISTS life_event_overrides (
    id TEXT PRIMARY KEY,
    trigger_text TEXT NOT NULL,
    normalized_trigger_text TEXT NOT NULL,
    target_life_event TEXT NOT NULL,
    note TEXT,
    reviewer TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    applied_count INTEGER NOT NULL DEFAULT 0,
    last_applied_at TEXT
  )`,
  'CREATE INDEX IF NOT EXISTS idx_life_event_overrides_status ON life_event_overrides(status, updated_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_life_event_overrides_target ON life_event_overrides(target_life_event, status)',
  `CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    action TEXT NOT NULL,
    user_id TEXT,
    entry_id TEXT,
    details TEXT
  )`,
  'CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp DESC)',
];

function normalizeScenarioMatchText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseJsonSafe(value, fallback = null) {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

async function ensureTables(db) {
  for (const statement of TABLE_SCHEMA_STATEMENTS) {
    await db.prepare(statement).run();
  }
}

async function listCases(db, status, limit) {
  const params = [];
  let whereClause = '';
  if (status && status !== 'all') {
    whereClause = 'WHERE resolved_status = ?';
    params.push(status);
  }

  const rowsResult = await db
    .prepare(
      `SELECT id, query, normalized_query, detected_stages, selected_life_event, editorial_review_reasons, occurrence_count, first_seen, last_seen, resolved_status, resolution_notes, resolved_by, resolved_at
       FROM life_event_review_cases
       ${whereClause}
       ORDER BY last_seen DESC
       LIMIT ?`
    )
    .bind(...params, limit)
    .all();

  return (rowsResult.results || []).map((row) => ({
    id: row.id,
    query: row.query,
    normalized_query: row.normalized_query,
    detected_stages: parseJsonSafe(row.detected_stages, []),
    selected_life_event: row.selected_life_event || null,
    editorial_review_reasons: parseJsonSafe(row.editorial_review_reasons, []),
    occurrence_count: Number(row.occurrence_count || 0),
    first_seen: row.first_seen,
    last_seen: row.last_seen,
    resolved_status: row.resolved_status,
    resolution_notes: row.resolution_notes || null,
    resolved_by: row.resolved_by || null,
    resolved_at: row.resolved_at || null,
  }));
}

async function listOverrides(db, status = 'all', limit = 200) {
  const params = [];
  let whereClause = '';
  if (status && status !== 'all') {
    whereClause = 'WHERE status = ?';
    params.push(status);
  }

  const rowsResult = await db
    .prepare(
      `SELECT id, trigger_text, normalized_trigger_text, target_life_event, note, reviewer, status, created_at, updated_at, applied_count, last_applied_at
       FROM life_event_overrides
       ${whereClause}
       ORDER BY updated_at DESC
       LIMIT ?`
    )
    .bind(...params, limit)
    .all();

  return (rowsResult.results || []).map((row) => ({
    id: row.id,
    trigger_text: row.trigger_text,
    normalized_trigger_text: row.normalized_trigger_text,
    target_life_event: row.target_life_event,
    note: row.note || null,
    reviewer: row.reviewer || null,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    applied_count: Number(row.applied_count || 0),
    last_applied_at: row.last_applied_at || null,
  }));
}

async function writeAuditLog(db, payload) {
  await db
    .prepare('INSERT INTO audit_log (id, timestamp, action, user_id, entry_id, details) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(
      crypto.randomUUID(),
      payload.timestamp,
      payload.action,
      payload.user_id || 'admin',
      payload.entry_id || null,
      JSON.stringify(payload.details || {})
    )
    .run();
}

async function createOverride(db, body) {
  const triggerText = String(body?.trigger_text || '').trim();
  const targetLifeEvent = String(body?.target_life_event || '').trim().toLowerCase();
  const caseId = String(body?.case_id || '').trim();
  const reviewer = String(body?.reviewer || '').trim() || null;
  const note = String(body?.note || '').trim() || null;

  if (!triggerText || !targetLifeEvent) {
    throw new Error('trigger_text and target_life_event are required');
  }

  const now = new Date().toISOString();
  const overrideId = crypto.randomUUID();

  await db
    .prepare(
      `INSERT INTO life_event_overrides (
        id, trigger_text, normalized_trigger_text, target_life_event, note, reviewer, status, created_at, updated_at, applied_count, last_applied_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, 0, NULL)`
    )
    .bind(
      overrideId,
      triggerText,
      normalizeScenarioMatchText(triggerText),
      targetLifeEvent,
      note,
      reviewer,
      now,
      now
    )
    .run();

  if (caseId) {
    await db
      .prepare(
        `UPDATE life_event_review_cases
         SET resolved_status = 'resolved', resolution_notes = ?, resolved_by = ?, resolved_at = ?, last_seen = ?
         WHERE id = ?`
      )
      .bind(note, reviewer, now, now, caseId)
      .run();
  }

  await writeAuditLog(db, {
    timestamp: now,
    action: 'life_event_override_created',
    user_id: reviewer || 'admin',
    entry_id: caseId || null,
    details: {
      override_id: overrideId,
      trigger_text: triggerText,
      target_life_event: targetLifeEvent,
      note,
      case_id: caseId || null,
    },
  });

  return { id: overrideId, trigger_text: triggerText, target_life_event: targetLifeEvent, case_id: caseId || null };
}

async function disableOverride(db, body) {
  const overrideId = String(body?.override_id || '').trim();
  const reviewer = String(body?.reviewer || '').trim() || null;
  const note = String(body?.note || '').trim() || null;
  if (!overrideId) {
    throw new Error('override_id is required');
  }

  const now = new Date().toISOString();
  await db
    .prepare('UPDATE life_event_overrides SET status = ?, updated_at = ?, note = COALESCE(?, note) WHERE id = ?')
    .bind('disabled', now, note, overrideId)
    .run();

  await writeAuditLog(db, {
    timestamp: now,
    action: 'life_event_override_disabled',
    user_id: reviewer || 'admin',
    entry_id: null,
    details: {
      override_id: overrideId,
      note,
    },
  });

  return { id: overrideId, status: 'disabled' };
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') {
    return optionsResponse(request, env, { methods: 'GET, POST, OPTIONS', headers: 'Content-Type, Authorization' });
  }

  const db = env.DB;
  if (!db) {
    return jsonResponse({ error: 'Database unavailable' }, { status: 503, request, env, cors: true });
  }

  try {
    await ensureTables(db);

    if (request.method === 'GET') {
      const url = new URL(request.url);
      const status = (url.searchParams.get('status') || 'open').trim().toLowerCase();
      const limit = clampPositiveInt(url.searchParams.get('limit') || '200', 200, 500);
      const overrideStatus = (url.searchParams.get('override_status') || 'all').trim().toLowerCase();

      const [cases, overrides] = await Promise.all([
        listCases(db, status, limit),
        listOverrides(db, overrideStatus, 300),
      ]);

      return jsonResponse({ cases, overrides }, { request, env, cors: true });
    }

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, { status: 405, request, env, cors: true });
    }

    const bodyResult = await readJsonBody(request);
    if (!bodyResult.ok) {
      return jsonResponse({ error: bodyResult.error }, { status: bodyResult.status, request, env, cors: true });
    }

    const action = String(bodyResult.body?.action || 'create_override').trim().toLowerCase();
    if (action === 'create_override') {
      const created = await createOverride(db, bodyResult.body);
      return jsonResponse({ ok: true, action, override: created }, { request, env, cors: true });
    }

    if (action === 'disable_override') {
      const updated = await disableOverride(db, bodyResult.body);
      return jsonResponse({ ok: true, action, override: updated }, { request, env, cors: true });
    }

    return jsonResponse({ error: 'Unsupported action' }, { status: 400, request, env, cors: true });
  } catch (err) {
    return jsonResponse(
      {
        error: 'Failed to process life-event review request',
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500, request, env, cors: true }
    );
  }
}
