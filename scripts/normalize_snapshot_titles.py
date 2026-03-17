#!/usr/bin/env python3
"""Normalize noisy snapshot titles in-place.

Usage:
    python scripts/normalize_snapshot_titles.py
    python scripts/normalize_snapshot_titles.py --domains benefits tools
"""

from __future__ import annotations

import argparse
import json
import re
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DOMAINS = ["benefits", "aid", "tools", "organizations", "contacts"]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Normalize snapshot titles in data/<domain>/entries.json")
    parser.add_argument("--domains", nargs="+", default=DEFAULT_DOMAINS, choices=DEFAULT_DOMAINS)
    return parser.parse_args()


def _humanize_url_title(url: str) -> str:
    parsed = urllib.parse.urlparse(url or "")
    path = urllib.parse.unquote(parsed.path or "")
    slug = path.rstrip("/").split("/")[-1] or parsed.netloc
    slug = re.sub(r"\.(html|pdf)$", "", slug, flags=re.IGNORECASE)
    slug = slug.replace("-", " ").replace("_", " ").strip()
    slug = re.sub(r"\s+", " ", slug)
    if not slug:
        return url
    return slug[:1].upper() + slug[1:]


def normalize_title(title: str, url: str, domain: str) -> str:
    text = " ".join((title or "").split()).strip()
    if not text:
        return text

    text = text.replace("\u00ad", "")
    text = re.sub(r"(?<=[a-zäöüß])(?=[A-ZÄÖÜ])", " ", text)
    text = re.sub(r"(?<=[:;,.!?])(?=[^\s])", " ", text)
    text = re.sub(
        r"([A-Za-zÄÖÜäöüß]+(?:-[A-Za-zÄÖÜäöüß]+)+)(der|die|das|dem|den|des|und|im|in|am|für|von)\b",
        r"\1 \2",
        text,
        flags=re.IGNORECASE,
    )
    text = re.sub(r"\bEU\b", "EU", text)
    text = " ".join(text.split()).strip(" -|")

    fallback_prefix = f"{domain} - http"
    if text.lower().startswith(fallback_prefix):
        return _humanize_url_title(url)

    return text


def load_entries(path: Path) -> list[dict]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict) and isinstance(payload.get("entries"), list):
        return payload["entries"]
    return []


def write_entries(path: Path, domain: str, entries: list[dict]) -> None:
    payload = {
        "version": "0.1.0",
        "domain": domain,
        "entries": entries,
    }
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")


def main() -> int:
    args = parse_args()
    total_changed = 0

    for domain in args.domains:
        path = ROOT / "data" / domain / "entries.json"
        entries = load_entries(path)
        changed = 0
        for entry in entries:
            title = entry.get("title")
            if not isinstance(title, str) or not title.strip():
                continue
            cleaned = normalize_title(title, str(entry.get("url") or ""), domain)
            if cleaned != title:
                entry["title"] = cleaned
                changed += 1
        if changed:
            write_entries(path, domain, entries)
        print(f"{domain}: normalized_titles={changed}")
        total_changed += changed

    print(f"total_normalized={total_changed}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
