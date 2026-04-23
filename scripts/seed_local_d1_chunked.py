#!/usr/bin/env python3
"""Seed local Wrangler D1 in chunks to avoid large-file execute timeouts.

Usage:
  python scripts/seed_local_d1_chunked.py \
    --database systemfehler-db \
    --seed cloudflare-pages/d1/seed_entries.generated.sql
"""

from __future__ import annotations

import argparse
import math
import pathlib
import subprocess
import tempfile
import sys
from typing import List


def parse_sql_statements(seed_path: pathlib.Path) -> List[str]:
    statements: List[str] = []
    current: List[str] = []

    with seed_path.open("r", encoding="utf-8") as handle:
        for raw_line in handle:
            line = raw_line.rstrip("\n")
            stripped = line.strip()
            if not stripped or stripped.startswith("--"):
                continue
            current.append(line)
            if stripped.endswith(";"):
                statements.append("\n".join(current))
                current = []

    if current:
        statements.append("\n".join(current))

    return statements


def run_chunk(database: str, chunk_file: pathlib.Path, cwd: pathlib.Path) -> None:
    command = [
        "cmd",
        "/c",
        f"npx wrangler d1 execute {database} --local --file {chunk_file}",
    ]
    completed = subprocess.run(
        command,
        cwd=cwd,
        check=False,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
    )
    if completed.returncode != 0:
        if completed.stderr:
            try:
                sys.stdout.buffer.write(completed.stderr)
                sys.stdout.buffer.write(b"\n")
            except Exception:
                pass
        raise SystemExit(completed.returncode)


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed local D1 using chunked SQL execution.")
    parser.add_argument("--database", default="systemfehler-db", help="D1 database name")
    parser.add_argument("--seed", required=True, help="Path to generated seed SQL file")
    parser.add_argument("--chunk-size", type=int, default=60, help="Statements per chunk")
    parser.add_argument(
        "--wrangler-cwd",
        default="cloudflare-pages",
        help="Working directory where wrangler.toml lives",
    )
    args = parser.parse_args()

    seed_path = pathlib.Path(args.seed).resolve()
    wrangler_cwd = pathlib.Path(args.wrangler_cwd).resolve()
    if not seed_path.exists():
        raise SystemExit(f"Seed file not found: {seed_path}")
    if args.chunk_size < 1:
        raise SystemExit("--chunk-size must be >= 1")

    statements = parse_sql_statements(seed_path)
    if not statements:
        print("No SQL statements found; nothing to seed.")
        return 0

    total_chunks = math.ceil(len(statements) / args.chunk_size)
    print(f"Seeding {len(statements)} statements in {total_chunks} chunks...")

    with tempfile.TemporaryDirectory(prefix="systemfehler-d1-seed-") as tmp_dir:
        tmp_path = pathlib.Path(tmp_dir)
        for chunk_index in range(total_chunks):
            start = chunk_index * args.chunk_size
            end = start + args.chunk_size
            chunk_statements = statements[start:end]
            chunk_file = tmp_path / f"seed_chunk_{chunk_index + 1:04d}.sql"
            chunk_file.write_text("\n".join(chunk_statements) + "\n", encoding="utf-8")
            print(f"  chunk {chunk_index + 1}/{total_chunks} ({len(chunk_statements)} statements)")
            run_chunk(args.database, chunk_file, wrangler_cwd)

    print("Local D1 seeding complete.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
