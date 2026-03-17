#!/usr/bin/env python3
"""Prune entries that clearly do not fit their assigned domain.

This is intentionally conservative and only removes pages that are obviously
topic/overview/media pages rather than domain-matching entries.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

RULES: dict[str, list[tuple[str, re.Pattern[str]]]] = {
    "organizations": [
        (
            "bmas_topic_page",
            re.compile(r"^https://www\.bmas\.de/DE/(Arbeit|Soziales|Europa-und-die-Welt)/", re.IGNORECASE),
        ),
        (
            "bmbfsfj_theme_media_meta",
            re.compile(r"^https://www\.bmbfsfj\.bund\.de/bmbfsfj/(themen|mediathek|meta)/", re.IGNORECASE),
        ),
    ],
    "aid": [
        (
            "bmbfsfj_root_page",
            re.compile(r"^https://www\.bmbfsfj\.bund\.de/bmbfsfj/?$", re.IGNORECASE),
        ),
        (
            "bmbfsfj_theme_root",
            re.compile(r"^https://www\.bmbfsfj\.bund\.de/bmbfsfj/themen/[^/]+/?$", re.IGNORECASE),
        ),
    ],
}


def load_entries(path: Path) -> list[dict]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(payload, dict):
        return list(payload.get("entries", []))
    return list(payload)


def write_entries(path: Path, domain: str, entries: list[dict]) -> None:
    path.write_text(
        json.dumps({"version": "0.1.0", "domain": domain, "entries": entries}, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


def prune_domain(domain: str) -> tuple[int, dict[str, int]]:
    path = ROOT / "data" / domain / "entries.json"
    entries = load_entries(path)
    kept: list[dict] = []
    removed_counts: dict[str, int] = {}

    for entry in entries:
        url = str(entry.get("url") or "")
        reason = None
        for candidate_reason, pattern in RULES.get(domain, []):
            if pattern.search(url):
                reason = candidate_reason
                break
        if reason:
            removed_counts[reason] = removed_counts.get(reason, 0) + 1
            continue
        kept.append(entry)

    if len(kept) != len(entries):
        write_entries(path, domain, kept)

    return len(entries) - len(kept), removed_counts


def main() -> int:
    total_removed = 0
    for domain in ("aid", "organizations"):
        removed, counts = prune_domain(domain)
        total_removed += removed
        print(f"{domain}: removed={removed} reasons={counts}")
    print(f"total_removed={total_removed}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
