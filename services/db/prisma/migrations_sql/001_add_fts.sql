-- Enable extensions (idempotent)
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add FTS columns (idempotent)
ALTER TABLE IF EXISTS entries ADD COLUMN IF NOT EXISTS tsv_de tsvector;
ALTER TABLE IF EXISTS entries ADD COLUMN IF NOT EXISTS tsv_en tsvector;

-- Populate once
UPDATE entries SET 
  tsv_de = to_tsvector('german', unaccent(coalesce(title_de,'') || ' ' || coalesce(summary_de,'') || ' ' || coalesce(body_de,''))),
  tsv_en = to_tsvector('english', unaccent(coalesce(title_en,'') || ' ' || coalesce(summary_en,'') || ' ' || coalesce(body_en,'')));

-- Indexes (idempotent)
DO $$ BEGIN
  CREATE INDEX idx_entries_tsv_de ON entries USING GIN (tsv_de);
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  CREATE INDEX idx_entries_tsv_en ON entries USING GIN (tsv_en);
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  CREATE INDEX idx_entries_title_de_trgm ON entries USING GIN (title_de gin_trgm_ops);
EXCEPTION WHEN duplicate_table THEN NULL; END $$;
