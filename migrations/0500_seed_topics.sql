-- Ensure topic table exists and is seeded according to schema
CREATE TABLE IF NOT EXISTS topic (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL
);

-- Example topics (add/adjust as needed for your domain)
INSERT OR IGNORE INTO topic (code, label) VALUES
  ('hilfe', 'Hilfe'),
  ('familie', 'Familie'),
  ('wohnen', 'Wohnen'),
  ('geld', 'Geld'),
  ('beratung', 'Beratung'),
  ('recht', 'Recht'),
  ('gesundheit', 'Gesundheit'),
  ('bildung', 'Bildung'),
  ('arbeit', 'Arbeit'),
  ('integration', 'Integration'),
  ('sozial', 'Soziales'),
  ('notfall', 'Notfall');
