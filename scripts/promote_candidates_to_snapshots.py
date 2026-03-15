#!/usr/bin/env python3
"""Promote high-quality candidates into canonical data snapshots.

This is a deterministic bulk-promotion helper for scaling trusted crawl output.
It is intentionally conservative: candidates must clear explicit quality and
content checks before they are merged into `data/<domain>/entries.json`.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from crawlers.shared.source_registry import SourceRegistry  # noqa: E402
DEFAULT_DOMAINS = ["benefits", "aid", "tools", "organizations", "contacts"]
MAX_CONTENT_LENGTH = 500_000
MAX_TITLE_LENGTH = 500
LOW_SIGNAL_TITLE_TOKENS = (
    "datenschutz",
    "cookie",
    "impressum",
    "hauptnavigation",
    "navigation",
    "startseite",
    "home",
)
LOW_SIGNAL_URL_TOKENS = (
    "/datenschutz",
    "/impressum",
    "/privacy",
    "/cookie",
    "/search",
    "/tag/",
    "/author/",
)
DOMAIN_LOW_SIGNAL_TITLE_TOKENS = {
    "aid": (
        "aktuell",
        "alle meldungen",
        "presse",
        "pressemitteilungen",
        "reden und interviews",
        "rss-service",
        "erklärung zur barrierefreiheit",
        "rechtliche hinweise",
        "deutsche gebärdensprache",
        "leichte sprache",
        "inhalt",
    ),
    "tools": (
        "newsletter",
        "kontakt",
        "service",
        "warenkorb",
        "porträts",
        "portraets",
        "downloads",
        "aktuelles",
        "presse",
    ),
    "organizations": (
        "lebenslauf",
        "gesetz",
        "vol.",
        "@",
    ),
    "contacts": (
        "aktuelles",
        "pressemitteilungen",
        "innovation",
    ),
}
DOMAIN_LOW_SIGNAL_URL_TOKENS = {
    "aid": (
        "/aktuelles",
        "/mediathek",
        "/meta/",
        "/erklaerung-zur-barrierefreiheit",
        "/informationen-zur-verarbeitung-personenbezogener-daten",
        "/gebaerdensprache",
        "/leichte-sprache",
        "/rechtliche-hinweise",
        "/downloads",
    ),
    "tools": (
        "/newsletter",
        "/warenkorb",
        "/service/kontakt",
        "/service/portraets",
        "/service/publikationen",
    ),
    "organizations": (
        "social.bund.de",
        "tiktok.com",
        "/issue/",
        "/ministerium/gesetze",
        "/ministerium/ministerin-hausleitung",
        "/bmbfsfj-als-arbeitgeber",
    ),
    "contacts": (
        "/news",
        "/presse",
        "/downloads",
        "/mediathek",
        "/fuer-behoerden",
        "/social.",
        "/social.bund.de",
    ),
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Promote high-quality crawler candidates into snapshots")
    parser.add_argument("--domains", nargs="+", default=DEFAULT_DOMAINS, choices=DEFAULT_DOMAINS)
    parser.add_argument("--min-iqs", type=float, default=75.0)
    parser.add_argument("--min-ais", type=float, default=70.0)
    parser.add_argument("--min-content-length", type=int, default=140)
    parser.add_argument("--apply", action="store_true", help="Write merged snapshots back to disk")
    return parser.parse_args()


def load_entries(path: Path) -> list[dict]:
    if not path.exists():
        return []
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


def best_text(entry: dict, field: str) -> str:
    value = entry.get(field)
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, dict):
        for key in ("de", "easy_de", "en"):
            candidate = value.get(key)
            if isinstance(candidate, str) and candidate.strip():
                return candidate.strip()
    legacy = entry.get(f"{field}_de")
    return legacy.strip() if isinstance(legacy, str) else ""


def score_value(entry: dict, key: str) -> float:
    quality = entry.get("qualityScores") or {}
    raw = quality.get(key)
    try:
        return float(raw)
    except (TypeError, ValueError):
        return 0.0


def source_tier(entry: dict) -> str:
    provenance = entry.get("provenance") or {}
    return str(provenance.get("sourceTier") or "").strip().lower()


SOURCE_REGISTRY = SourceRegistry(ROOT / "data")


def resolved_source_tier(entry: dict, domain: str) -> str:
    tier = source_tier(entry)
    if tier and tier != "tier_unknown":
        return tier
    url = str(entry.get("url") or "").strip()
    if not url:
        return tier
    profile = SOURCE_REGISTRY.resolve(url, domain)
    if not profile:
        return tier
    return profile.source_tier


def normalize_url_key(url: str) -> str:
    cleaned = (url or "").strip()
    if cleaned.endswith("/"):
        cleaned = cleaned[:-1]
    if cleaned.startswith("http://www.115.de"):
        cleaned = "https://" + cleaned[len("http://"):]
    return cleaned


def keep_candidate(
    entry: dict,
    domain: str,
    min_iqs: float,
    min_ais: float,
    min_content_length: int,
) -> tuple[bool, str]:
    title = best_text(entry, "title").lower()
    summary = best_text(entry, "summary").lower()
    content = best_text(entry, "content")
    url = str(entry.get("url") or "").lower()
    iqs = score_value(entry, "iqs")
    ais = score_value(entry, "ais")

    if len(title) > MAX_TITLE_LENGTH:
        return False, "oversized_title"
    if len(content.strip()) > MAX_CONTENT_LENGTH:
        return False, "oversized_content"
    if not title or any(token in title for token in LOW_SIGNAL_TITLE_TOKENS):
        return False, "low_signal_title"
    if any(token in title for token in DOMAIN_LOW_SIGNAL_TITLE_TOKENS.get(domain, ())):
        return False, "domain_low_signal_title"
    if any(token in url for token in LOW_SIGNAL_URL_TOKENS):
        return False, "low_signal_url"
    if any(token in url for token in DOMAIN_LOW_SIGNAL_URL_TOKENS.get(domain, ())):
        return False, "domain_low_signal_url"
    if resolved_source_tier(entry, domain) in {"", "tier_unknown"}:
        return False, "unknown_source_tier"
    if len(content.strip()) < min_content_length:
        return False, "thin_content"
    if summary and summary == title:
        return False, "summary_equals_title"
    if iqs < min_iqs:
        return False, "iqs_below_threshold"
    if ais < min_ais:
        return False, "ais_below_threshold"
    return True, "accepted"


def merge_domain(domain: str, min_iqs: float, min_ais: float, min_content_length: int, apply: bool) -> dict:
    domain_dir = ROOT / "data" / domain
    entries_path = domain_dir / "entries.json"
    candidates_path = domain_dir / "candidates.json"

    existing_entries = load_entries(entries_path)
    candidates = load_entries(candidates_path)

    existing_by_url = {}
    dropped_existing = 0
    for entry in existing_entries:
        if not entry.get("url"):
            continue
        title = best_text(entry, "title")
        content = best_text(entry, "content")
        if len(title) > MAX_TITLE_LENGTH or len(content.strip()) > MAX_CONTENT_LENGTH:
            dropped_existing += 1
            continue
        existing_by_url[normalize_url_key(str(entry.get("url")))] = entry
    promoted = []
    rejected = {}

    for candidate in candidates:
        keep, reason = keep_candidate(candidate, domain, min_iqs, min_ais, min_content_length)
        if not keep:
            rejected[reason] = rejected.get(reason, 0) + 1
            continue
        url = normalize_url_key(str(candidate.get("url")))
        if url in existing_by_url:
            current = existing_by_url[url]
            current_ais = score_value(current, "ais")
            current_iqs = score_value(current, "iqs")
            if score_value(candidate, "ais") > current_ais or score_value(candidate, "iqs") > current_iqs:
                existing_by_url[url] = candidate
                promoted.append(url)
        else:
            existing_by_url[url] = candidate
            promoted.append(url)

    merged = list(existing_by_url.values())
    merged.sort(key=lambda item: (str(item.get("url") or ""), str(item.get("id") or "")))

    if apply and (promoted or dropped_existing):
        write_entries(entries_path, domain, merged)

    return {
        "domain": domain,
        "existing": len(existing_entries),
        "candidates": len(candidates),
        "promoted": len(promoted),
        "total_after_merge": len(merged),
        "dropped_existing": dropped_existing,
        "rejected": rejected,
        "applied": apply,
    }


def main() -> int:
    args = parse_args()
    reports = [
        merge_domain(domain, args.min_iqs, args.min_ais, args.min_content_length, args.apply)
        for domain in args.domains
    ]

    for report in reports:
        print(
            f"{report['domain']}: existing={report['existing']} candidates={report['candidates']} "
            f"promoted={report['promoted']} dropped_existing={report['dropped_existing']} "
            f"total={report['total_after_merge']} rejected={report['rejected']}"
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
