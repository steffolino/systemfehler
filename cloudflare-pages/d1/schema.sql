-- D1 schema for systemfehler Cloudflare Pages

CREATE TABLE IF NOT EXISTS entries (
  id         TEXT PRIMARY KEY,
  domain     TEXT NOT NULL,
  url        TEXT,
  status     TEXT,
  title_de   TEXT,
  updated_at TEXT,
  entry_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_entries_domain ON entries (domain);
CREATE INDEX IF NOT EXISTS idx_entries_status ON entries (status);

CREATE TABLE IF NOT EXISTS moderation_queue (
  id              TEXT PRIMARY KEY,
  entry_id        TEXT,
  domain          TEXT,
  status          TEXT NOT NULL DEFAULT 'pending',
  action          TEXT,
  title_de        TEXT,
  url             TEXT,
  candidate_data  TEXT,
  existing_data   TEXT,
  diff            TEXT,
  provenance      TEXT,
  reviewed_by     TEXT,
  reviewed_at     TEXT,
  created_at      TEXT,
  updated_at      TEXT
);

CREATE INDEX IF NOT EXISTS idx_moderation_queue_status ON moderation_queue (status);
CREATE INDEX IF NOT EXISTS idx_moderation_queue_domain ON moderation_queue (domain);
CREATE INDEX IF NOT EXISTS idx_moderation_queue_created_at ON moderation_queue (created_at);
