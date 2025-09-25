
import sqlite3
from pathlib import Path
import sys

DB = Path(sys.argv[1] if len(sys.argv) > 1 else "data/systemfehler.db")

CATEGORY_MAP = {
    'benefits': 'service',
    'aid': 'service',
    'contacts': 'organization',
    'tools': 'tool',
    'form': 'form',
    'meta': 'glossary',
    'association': 'association',
    'legal_aid': 'legal_aid'
}

def assert_staging_entry_exists(cur):
    cur.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='staging_entry';")
    if not cur.fetchone():
        raise RuntimeError("staging_entry table does not exist!")

def log_category_counts(cur):
    print("Current counts by category:")
    cur.execute("SELECT category, COUNT(*) FROM staging_entry GROUP BY category;")
    for cat, cnt in cur.fetchall():
        print(f"  {cat}: {cnt}")

def main():
    with sqlite3.connect(DB, timeout=30) as con:
        cur = con.cursor()
        assert_staging_entry_exists(cur)
        log_category_counts(cur)

        for key, category in CATEGORY_MAP.items():
            cur.execute("SELECT * FROM staging_entry WHERE category=?", (category,))
            rows = cur.fetchall()
            print(f"Rows for {category}: {len(rows)}")
            # Here you would map and upsert into canonical tables as needed
            # For now, just print a sample row for verification
            if rows:
                print(f"Sample {category}: {rows[0]}")

if __name__ == "__main__":
    main()
