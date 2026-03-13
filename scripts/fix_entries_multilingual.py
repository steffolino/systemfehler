#!/usr/bin/env python3
"""
Update the 'title' column in the entries table to a JSON object using the existing 'title_de', 'title_en', and 'title_easy_de' columns.
Usage:
    python scripts/fix_entries_multilingual.py
"""
import os
from sqlalchemy import create_engine, text

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://systemfehler:dev_password@localhost:5432/systemfehler")
engine = create_engine(DATABASE_URL)

def main():
    with engine.begin() as conn:  # begin() ensures commit
        result = conn.execute(text("SELECT id, title_de, title FROM entries"))
        rows = result.fetchall()
        for row in rows:
            before = row.title
            title_val = row.title_de if row.title_de is not None else ''
            conn.execute(
                text("UPDATE entries SET title = :title WHERE id = :id"),
                {"title": title_val, "id": row.id}
            )
            print(f"Updated entry {row.id}: {before!r} -> {title_val!r}")

if __name__ == "__main__":
    main()
