-- Migration: Add pg_trgm extension and GIN trigram indexes for substring search

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_entries_title_de_trgm
  ON entries USING gin (title_de gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_entries_title_en_trgm
  ON entries USING gin (title_en gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_entries_title_easy_de_trgm
  ON entries USING gin (title_easy_de gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_entries_summary_de_trgm
  ON entries USING gin (summary_de gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_entries_summary_en_trgm
  ON entries USING gin (summary_en gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_entries_summary_easy_de_trgm
  ON entries USING gin (summary_easy_de gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_entries_content_de_trgm
  ON entries USING gin (content_de gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_entries_content_en_trgm
  ON entries USING gin (content_en gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_entries_content_easy_de_trgm
  ON entries USING gin (content_easy_de gin_trgm_ops);
