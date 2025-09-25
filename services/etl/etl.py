#!/usr/bin/env python3
"""
Deterministic ETL from staging_entry -> canonical tables.
- SQLite only; idempotent UPSERTs.
- No schema edits; adapts to whatever columns exist in each canonical table.
- Populates language variants if the columns exist (title_de, title_en, title_simple_de, ...),
  else fills the generic title/summary if present.
"""

import os, sys, json, sqlite3, hashlib
from datetime import datetime

CATEGORY_TO_TABLE = {
    "organization": "organization",
    "service": "service",
    "tool": "tool",
    "form": "form",
    "glossary": "glossary",
    "legal_aid": "legal_aid",
    "association": "association",
}

ISO_NOW = datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
DB_PATH = os.environ.get("SF_SQLITE", os.path.join(os.getcwd(), "data", "systemfehler.db"))

def connect(db_path: str) -> sqlite3.Connection:
    con = sqlite3.connect(db_path)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys=ON;")
    return con

def table_exists(con: sqlite3.Connection, name: str) -> bool:
    cur = con.execute("SELECT name FROM sqlite_master WHERE type IN ('table','view') AND name=?;", (name,))
    return cur.fetchone() is not None

def get_cols(con: sqlite3.Connection, table: str) -> set:
    rows = con.execute(f"PRAGMA table_info({table});").fetchall()
    return {r["name"] for r in rows}

def parse_payload(payload_str):
    if not payload_str:
        return {}
    try:
        return json.loads(payload_str)
    except Exception:
        return {}

def pick_lang_variants(row, payload):
    """
    Returns a dict with potential language-specific fields if the target table has them:
    - title_de, title_en, title_simple_de
    - summary_de, summary_en, summary_simple_de
    Falls back gracefully.
    """
    lang = (row["language"] or "de").lower()
    title = row["title"] or ""
    summary = row["summary"] or ""
    variants = {
        "title_de": None, "title_en": None, "title_simple_de": None,
        "summary_de": None, "summary_en": None, "summary_simple_de": None,
    }

    # Base from staging language
    if lang.startswith("de"):
        if lang in ("de", "de-de", "de_at", "de_ch"):
            variants["title_de"] = title
            variants["summary_de"] = summary
        # some crawlers may emit 'de_simple'
        if lang.startswith("de_simple"):
            variants["title_simple_de"] = title
            variants["summary_simple_de"] = summary
    elif lang.startswith("en"):
        variants["title_en"] = title
        variants["summary_en"] = summary

    # Optional translations in payload.translations
    tr = (payload.get("translations") or {})
    def take(dct, key):
        v = dct.get(key)
        return v if isinstance(v, str) and v.strip() else None

    de_simple = tr.get("de_simple") or tr.get("de-simple") or {}
    en = tr.get("en") or {}
    de = tr.get("de") or {}

    variants["title_simple_de"] = variants["title_simple_de"] or take(de_simple, "title")
    variants["summary_simple_de"] = variants["summary_simple_de"] or take(de_simple, "summary")
    variants["title_en"] = variants["title_en"] or take(en, "title")
    variants["summary_en"] = variants["summary_en"] or take(en, "summary")
    variants["title_de"] = variants["title_de"] or take(de, "title")
    variants["summary_de"] = variants["summary_de"] or take(de, "summary")

    return variants

def build_row_for_table(row, table_cols: set):
    """
    Create a per-table dict, only with columns that exist in the target table.
    Common columns supported (use what’s available):
      id, url, title, summary, title_de, title_en, title_simple_de, summary_*, topic, language,
      content, keywords, status, last_checked, updatedAt|updated_at, source_domain (if present)
    """
    payload = parse_payload(row["payload"])
    variants = pick_lang_variants(row, payload)

    data = {}
    # Always set id if present
    if "id" in table_cols:
        data["id"] = row["id"]
    # Use only columns that exist in the table, with minimal mapping
    for col in table_cols:
        if col in row.keys():
            data[col] = row[col]
        elif col == "url" and "source_url" in row.keys():
            data["url"] = row["source_url"]
        elif col.startswith("title") and col in variants and variants[col]:
            data[col] = variants[col]
        elif col.startswith("summary") and col in variants and variants[col]:
            data[col] = variants[col]
        elif col == "name" and "name" in row.keys() and row["name"]:
            data["name"] = row["name"]
        elif col == "name" and "title" in row.keys() and row["title"]:
            data["name"] = row["title"]
        elif col == "last_checked":
            data["last_checked"] = ISO_NOW
        elif col == "updatedAt":
            data["updatedAt"] = ISO_NOW
        elif col == "updated_at":
            data["updated_at"] = ISO_NOW
        elif col == "status":
            data["status"] = "auto_processed"
    # Remove None values
    return {k: v for k, v in data.items() if v is not None}

def upsert(con, table: str, data: dict):
    if not data or "id" not in data:
        return
    cols = list(data.keys())
    placeholders = ", ".join(["?"] * len(cols))
    assignments = ", ".join([f"{c}=excluded.{c}" for c in cols if c != "id"])
    sql = f"INSERT INTO {table} ({', '.join(cols)}) VALUES ({placeholders}) " \
          f"ON CONFLICT(id) DO UPDATE SET {assignments};"
    con.execute(sql, [data[c] for c in cols])

def run_etl(limit=None):
    con = connect(DB_PATH)

    if not table_exists(con, "staging_entry"):
        print("ERROR: staging_entry not found in DB:", DB_PATH, file=sys.stderr)
        sys.exit(2)

    # Load all staging rows (optionally limit)
    q = "SELECT * FROM staging_entry ORDER BY last_seen DESC"
    if limit:
        q += f" LIMIT {int(limit)}"
    rows = con.execute(q).fetchall()

    counts = {}
    missing_tables = set()

    # Preload table columns per canonical table (present ones)
    table_cols_cache = {}
    for cat, tbl in CATEGORY_TO_TABLE.items():
        if table_exists(con, tbl):
            table_cols_cache[tbl] = get_cols(con, tbl)

    with con:
        for r in rows:
            cat = (r["category"] or "").strip().lower()
            tbl = CATEGORY_TO_TABLE.get(cat)
            if not tbl:
                continue
            if tbl not in table_cols_cache:
                # canonical table not present; record and skip
                missing_tables.add(tbl)
                continue

            row_for_tbl = build_row_for_table(r, table_cols_cache[tbl])
            if not row_for_tbl:
                continue
            upsert(con, tbl, row_for_tbl)
            counts[tbl] = counts.get(tbl, 0) + 1

    if missing_tables:
        print("WARN: missing canonical tables ->", ", ".join(sorted(missing_tables)))
    print("ETL done.", "Inserted/updated per table:", counts)

if __name__ == "__main__":
    # Usage: SF_SQLITE=/abs/path/to/systemfehler.db python services/etl/etl.py [limit]
    lim = sys.argv[1] if len(sys.argv) > 1 else None
    print(f"DB = {DB_PATH}")
    run_etl(limit=lim)
