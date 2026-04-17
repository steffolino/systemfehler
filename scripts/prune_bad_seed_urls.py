#!/usr/bin/env python3
"""Prune blocked URLs from seed manifests using crawl guardrails."""

from __future__ import annotations

import json
import sys
import urllib.parse
from pathlib import Path
from typing import Any, Dict, List, Tuple

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from crawlers.shared.crawl_guardrails import CrawlGuardrails

DATA_DIR = ROOT / "data"
TRACKING_PARAMS = {
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "fbclid",
    "gclid",
    "ref",
    "source",
    "mc_cid",
    "mc_eid",
}


def normalize_url(url: str) -> str:
    parsed = urllib.parse.urlparse(url)
    netloc = parsed.netloc.lower()
    if netloc.endswith(":80"):
        netloc = netloc[:-3]
    elif netloc.endswith(":443"):
        netloc = netloc[:-4]
    query_params = urllib.parse.parse_qs(parsed.query)
    cleaned_params = {k: v for k, v in query_params.items() if k not in TRACKING_PARAMS}
    sorted_query = urllib.parse.urlencode(sorted(cleaned_params.items()), doseq=True)
    path = parsed.path
    if path != "/" and path.endswith("/"):
        path = path[:-1]
    return urllib.parse.urlunparse((parsed.scheme, netloc, path, parsed.params, sorted_query, ""))


def prune_seed_items(items: List[Any], guardrails: CrawlGuardrails) -> Tuple[List[Any], int, Dict[str, int]]:
    pruned: List[Any] = []
    seen = set()
    removed = 0
    reasons: Dict[str, int] = {}
    for item in items:
        url = item.strip() if isinstance(item, str) else (item.get("url", "").strip() if isinstance(item, dict) else "")
        if not url:
            removed += 1
            reasons["missing_url"] = reasons.get("missing_url", 0) + 1
            continue
        normalized = normalize_url(url)
        blocked, reason = guardrails.is_blocked(normalized)
        if blocked:
            removed += 1
            reasons[reason] = reasons.get(reason, 0) + 1
            continue
        if normalized in seen:
            removed += 1
            reasons["duplicate"] = reasons.get("duplicate", 0) + 1
            continue
        seen.add(normalized)
        if isinstance(item, dict):
            copied = dict(item)
            copied["url"] = normalized
            pruned.append(copied)
        else:
            pruned.append(normalized)
    return pruned, removed, reasons


def prune_manifest(path: Path, guardrails: CrawlGuardrails) -> Tuple[int, Dict[str, int]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        return 0, {}

    key = "seeds" if isinstance(payload.get("seeds"), list) else "urls" if isinstance(payload.get("urls"), list) else None
    if key is None:
        return 0, {}

    items = payload.get(key) or []
    pruned, removed, reasons = prune_seed_items(items, guardrails)
    if removed > 0:
        payload[key] = pruned
        path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return removed, reasons


def main() -> int:
    guardrails = CrawlGuardrails(str(DATA_DIR), normalize_url)
    targets = ("seeds.json", "urls.json", "auto_discovered.json")
    total_removed = 0

    for domain_dir in sorted(path for path in DATA_DIR.iterdir() if path.is_dir() and not path.name.startswith("_")):
        for filename in targets:
            manifest_path = domain_dir / filename
            if not manifest_path.exists():
                continue
            removed, reasons = prune_manifest(manifest_path, guardrails)
            if removed > 0:
                total_removed += removed
                print(f"{domain_dir.name}/{filename}: removed={removed} reasons={reasons}")

    print(f"total_removed={total_removed}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
