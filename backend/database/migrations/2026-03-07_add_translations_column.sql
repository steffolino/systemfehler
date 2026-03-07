-- Migration: Add translations column to entries table if missing
ALTER TABLE entries ADD COLUMN IF NOT EXISTS translations JSONB;

-- (Optional) Create GIN index for translations if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE tablename = 'entries' AND indexname = 'idx_entries_translations'
    ) THEN
        CREATE INDEX idx_entries_translations ON entries USING GIN(translations);
    END IF;
END$$;
