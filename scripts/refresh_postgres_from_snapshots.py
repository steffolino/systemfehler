#!/usr/bin/env python3
"""Replace PostgreSQL entries with the current snapshot data.

Usage:
    python scripts/refresh_postgres_from_snapshots.py
    python scripts/refresh_postgres_from_snapshots.py --domains benefits aid

Requires:
    DATABASE_URL
    psycopg2
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import psycopg2

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from crawlers.cli import import_to_db  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Refresh PostgreSQL from current snapshots")
    parser.add_argument(
        "--domains",
        nargs="+",
        default=["benefits", "aid", "tools", "organizations", "contacts"],
        choices=["benefits", "aid", "tools", "organizations", "contacts"],
        help="Domains to replace and re-import",
    )
    parser.add_argument(
        "--data-dir",
        default=str(ROOT / "data"),
        help="Path to snapshot data directory",
    )
    return parser.parse_args()


def delete_existing_rows(database_url: str, domains: list[str]) -> None:
    conn = psycopg2.connect(database_url)
    try:
        with conn:
            with conn.cursor() as cur:
                for domain in domains:
                    cur.execute("DELETE FROM entries WHERE domain = %s", (domain,))
    finally:
        conn.close()


def main() -> int:
    args = parse_args()
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("DATABASE_URL not set", file=sys.stderr)
        return 1

    data_dir = Path(args.data_dir)
    missing = [domain for domain in args.domains if not (data_dir / domain / "entries.json").exists()]
    if missing:
        print(f"Missing snapshot files for domains: {', '.join(missing)}", file=sys.stderr)
        return 1

    delete_existing_rows(database_url, args.domains)

    ok = True
    for domain in args.domains:
        imported = import_to_db(domain, str(data_dir))
        ok = ok and imported

    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
