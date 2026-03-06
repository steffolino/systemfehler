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
