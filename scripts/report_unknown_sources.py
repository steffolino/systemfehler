#!/usr/bin/env python3
"""Report unknown or invalid source entities for human review."""

from __future__ import annotations

import argparse
import json
import sys
import urllib.parse
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from crawlers.shared.source_metadata_enrichment import normalized_unknown  # noqa: E402


DOMAINS = ("benefits", "aid", "tools", "organizations", "contacts")
VALID_TIERS = {
    "tier_1_official",
    "tier_2_official",
    "tier_2_ngo_watchdog",
    "tier_3_ngo",
    "tier_3_press",
    "tier_4_academic",
    "tier_4_other",
    "tier_5_contextual",
    "tier_5_partisan_context",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate a human review list for unknown source hosts")
    parser.add_argument("--data-dir", default=str(ROOT / "data"))
    parser.add_argument("--out-dir", default=str(ROOT / "data" / "_quality"))
    return parser.parse_args()


def load_entries(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    payload = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(payload, list):
        return [entry for entry in payload if isinstance(entry, dict)]
    if isinstance(payload, dict) and isinstance(payload.get("entries"), list):
        return [entry for entry in payload["entries"] if isinstance(entry, dict)]
    return []


def host_for_url(url: str) -> str:
    parsed = urllib.parse.urlparse(url or "")
    host = (parsed.netloc or "").lower()
    return host[4:] if host.startswith("www.") else host


def best_text(entry: dict[str, Any], key: str) -> str:
    value = entry.get(key)
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, dict):
        for lang in ("de", "easy_de", "en"):
            candidate = value.get(lang)
            if isinstance(candidate, str) and candidate.strip():
                return candidate.strip()
    legacy = entry.get(f"{key}_de")
    return legacy.strip() if isinstance(legacy, str) else ""


def source_tier(entry: dict[str, Any]) -> str:
    provenance = entry.get("provenance") if isinstance(entry.get("provenance"), dict) else {}
    return str(provenance.get("sourceTier") or entry.get("sourceTier") or "").strip().lower()


def source_id_from_host(host: str) -> str:
    return host.replace("-", "_").replace(".", "_")


def collect_unknown_sources(data_dir: Path) -> list[dict[str, Any]]:
    grouped: dict[str, dict[str, Any]] = {}
    for domain in DOMAINS:
        for entry in load_entries(data_dir / domain / "entries.json"):
            tier = source_tier(entry)
            if not normalized_unknown(tier) and tier in VALID_TIERS:
                continue
            url = str(entry.get("url") or "").strip()
            host = host_for_url(url)
            if not host:
                host = "(missing-host)"
            group = grouped.setdefault(
                host,
                {
                    "host": host,
                    "suggestedSourceId": source_id_from_host(host),
                    "currentTiers": set(),
                    "domains": set(),
                    "count": 0,
                    "samples": [],
                },
            )
            group["currentTiers"].add(tier or "(missing)")
            group["domains"].add(domain)
            group["count"] += 1
            if len(group["samples"]) < 5:
                group["samples"].append(
                    {
                        "domain": domain,
                        "tier": tier or "(missing)",
                        "title": best_text(entry, "title"),
                        "url": url,
                    }
                )

    report = []
    for group in grouped.values():
        report.append(
            {
                "host": group["host"],
                "suggestedSourceId": group["suggestedSourceId"],
                "currentTiers": sorted(group["currentTiers"]),
                "domains": sorted(group["domains"]),
                "count": group["count"],
                "samples": group["samples"],
                "reviewDecision": "ask_user",
                "registryStub": {
                    "id": group["suggestedSourceId"],
                    "name": "",
                    "baseUrl": f"https://{group['host']}" if group["host"] != "(missing-host)" else "",
                    "canonicalDomain": group["host"] if group["host"] != "(missing-host)" else "",
                    "hosts": [group["host"]] if group["host"] != "(missing-host)" else [],
                    "domains": sorted(group["domains"]),
                    "sourceTier": "tier_unknown",
                    "sourceTierStatus": "unknown",
                    "institutionType": "unknown",
                    "providerLevel": "unknown",
                    "jurisdiction": "DE",
                    "reviewStatus": "needs_review",
                    "notes": "Needs human source-quality decision.",
                },
            }
        )
    report.sort(key=lambda item: (-item["count"], item["host"]))
    return report


def write_markdown(path: Path, report: list[dict[str, Any]]) -> None:
    lines = [
        "# Unknown Source Review",
        "",
        "These source entities are not approved by the registry yet. Decide whether to add them to `data/_sources/registered_sources.json`, reject their entries, or keep them unknown.",
        "",
    ]
    if not report:
        lines.append("_No unknown or invalid source tiers found._")
    for item in report:
        lines.extend(
            [
                f"## {item['host']}",
                "",
                f"- Suggested source id: `{item['suggestedSourceId']}`",
                f"- Current tiers: {', '.join(item['currentTiers'])}",
                f"- Domains: {', '.join(item['domains'])}",
                f"- Entry count: {item['count']}",
                "- Decision needed: approve / reject / keep unknown",
                "",
                "Samples:",
            ]
        )
        for sample in item["samples"]:
            lines.append(f"- `{sample['domain']}` `{sample['tier']}` [{sample['title']}]({sample['url']})")
        lines.extend(
            [
                "",
                "Registry stub:",
                "",
                "```json",
                json.dumps(item["registryStub"], indent=2, ensure_ascii=False),
                "```",
                "",
            ]
        )
    path.write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    args = parse_args()
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    report = collect_unknown_sources(Path(args.data_dir))
    json_path = out_dir / "unknown_sources_review.json"
    md_path = out_dir / "unknown_sources_review.md"
    json_path.write_text(json.dumps({"sources": report}, indent=2, ensure_ascii=False), encoding="utf-8")
    write_markdown(md_path, report)
    print(f"Wrote {json_path}")
    print(f"Wrote {md_path}")
    print(f"Unknown source hosts: {len(report)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
