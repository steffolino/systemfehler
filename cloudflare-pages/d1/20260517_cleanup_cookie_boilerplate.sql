CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  action TEXT NOT NULL,
  user_id TEXT,
  entry_id TEXT,
  details TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp DESC);

DELETE FROM entries
WHERE entry_json LIKE '%Mit der Einwilligung von Nutzenden%'
   OR entry_json LIKE '%webverhalten- Analysetool%'
   OR entry_json LIKE '%Matomo%'
   OR url LIKE '%/dynamic/action/%'
   OR url LIKE '%!zip-search%';
