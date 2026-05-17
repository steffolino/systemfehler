#!/usr/bin/env python3
"""Remove snapshot entries whose content is cookie-consent boilerplate."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOMAINS = ("benefits", "aid", "tools", "organizations", "contacts")
BAD_TOKENS = (
    "mit der einwilligung von nutzenden",
    "webverhalten- analysetool",
    "webverhalten-analysetool",
    "webverhalten analysetool",
    "matomo",
    "einwilligen ablehnen",
)
BAD_URL_TOKENS = (
    "/dynamic/action/",
    "!zip-search",
)


def best_text(entry: dict, field: str) -> str:
    value = entry.get(field)
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        for key in ("de", "easy_de", "en"):
            nested = value.get(key)
            if isinstance(nested, str) and nested.strip():
                return nested
    return ""


def is_bad_entry(entry: dict) -> bool:
    url = str(entry.get("url") or "").lower()
    text = " ".join((best_text(entry, "summary"), best_text(entry, "content"))).lower()
    return any(token in text for token in BAD_TOKENS) or any(token in url for token in BAD_URL_TOKENS)


def main() -> None:
    removed_total = 0
    for domain in DOMAINS:
        path = ROOT / "data" / domain / "entries.json"
        if not path.exists():
            continue
        payload = json.loads(path.read_text(encoding="utf-8-sig"))
        entries = payload.get("entries") if isinstance(payload, dict) else payload
        if not isinstance(entries, list):
            continue
        kept = [entry for entry in entries if not is_bad_entry(entry)]
        removed = len(entries) - len(kept)
        if removed == 0:
            continue
        removed_total += removed
        if isinstance(payload, dict):
            payload["entries"] = kept
            output = payload
        else:
            output = kept
        path.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"{domain}: removed {removed} cookie/search boilerplate entries")

    print(f"Removed {removed_total} entries total")


if __name__ == "__main__":
    main()
