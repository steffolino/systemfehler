#!/usr/bin/env python3
"""Ingest all domain snapshots into Cloudflare Pages D1 via admin endpoint."""

from __future__ import annotations

import argparse
import pathlib
import subprocess
import sys


DOMAINS = ("benefits", "aid", "tools", "organizations", "contacts")


def main() -> int:
    parser = argparse.ArgumentParser(description="Ingest all domains into D1")
    parser.add_argument(
        "--domains",
        nargs="*",
        default=list(DOMAINS),
        help="Optional subset of domains to ingest",
    )
    parser.add_argument(
        "--data-dir",
        default="data",
        help="Base data directory containing <domain>/entries.json",
    )
    args = parser.parse_args()

    root = pathlib.Path(__file__).resolve().parents[1]
    ingest_script = root / "scripts" / "ingest_to_d1.py"
    data_dir = root / args.data_dir

    domains = [d for d in args.domains if d in DOMAINS]
    if not domains:
        print("No valid domains selected.", file=sys.stderr)
        return 1

    for domain in domains:
        snapshot = data_dir / domain / "entries.json"
        if not snapshot.exists():
            print(f"Skipping {domain}: snapshot not found ({snapshot})")
            continue

        command = [
            sys.executable,
            str(ingest_script),
            "--domain",
            domain,
            "--snapshot",
            str(snapshot),
            "--chunk-size",
            "250",
        ]
        print(f"Ingesting {domain} from {snapshot}...")
        result = subprocess.run(command, check=False)
        if result.returncode != 0:
            return result.returncode

    print("All selected domains ingested successfully.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
