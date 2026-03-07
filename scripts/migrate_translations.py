import psycopg2

sql = """
ALTER TABLE entries ADD COLUMN IF NOT EXISTS translations JSONB;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE tablename = 'entries' AND indexname = 'idx_entries_translations'
    ) THEN
        CREATE INDEX idx_entries_translations ON entries USING GIN(translations);
    END IF;
END$$;
"""

conn = psycopg2.connect("postgresql://systemfehler:dev_password@localhost:5432/systemfehler")
cur = conn.cursor()
cur.execute(sql)
conn.commit()
cur.close()
conn.close()
print("Migration applied.")