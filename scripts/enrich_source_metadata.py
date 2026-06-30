#!/usr/bin/env python3
"""Fill missing/unknown source metadata from the shared source registry.

This command is deterministic and offline. It only promotes a source tier when
the registry can classify the URL; otherwise the tier remains unknown.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from crawlers.shared.source_metadata_enrichment import enrich_entry_source_metadata  # noqa: E402
from crawlers.shared.source_registry import SourceRegistry  # noqa: E402


DEFAULT_DOMAINS = ["benefits", "aid", "tools", "organizations", "contacts"]
DEFAULT_KINDS = ["entries", "candidates"]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Enrich unknown source tiers from the source registry")
    parser.add_argument("--domains", nargs="+", default=DEFAULT_DOMAINS, choices=DEFAULT_DOMAINS)
    parser.add_argument("--kinds", nargs="+", default=DEFAULT_KINDS, choices=DEFAULT_KINDS)
    parser.add_argument("--data-dir", default=str(ROOT / "data"))
    parser.add_argument("--apply", action="store_true", help="Write enriched files back to disk")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite already curated source metadata")
    return parser.parse_args()


def load_payload(path: Path) -> tuple[Any, list[dict[str, Any]]]:
    if not path.exists():
        return None, []
    payload = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(payload, list):
        return payload, [entry for entry in payload if isinstance(entry, dict)]
    if isinstance(payload, dict) and isinstance(payload.get("entries"), list):
        return payload, [entry for entry in payload["entries"] if isinstance(entry, dict)]
    return payload, []


def write_payload(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")


def enrich_file(
    path: Path,
    domain: str,
    registry: SourceRegistry,
    *,
    apply: bool,
    overwrite: bool,
) -> dict[str, Any]:
    payload, entries = load_payload(path)
    changed = 0
    for entry in entries:
        if enrich_entry_source_metadata(entry, domain, registry, overwrite=overwrite):
            changed += 1

    if apply and payload is not None and changed:
        write_payload(path, payload)

    return {
        "path": str(path),
        "exists": payload is not None,
        "entries": len(entries),
        "changed": changed,
        "applied": apply,
    }


def main() -> int:
    args = parse_args()
    data_dir = Path(args.data_dir)
    registry = SourceRegistry(data_dir)

    reports = []
    for domain in args.domains:
        for kind in args.kinds:
            reports.append(
                enrich_file(
                    data_dir / domain / f"{kind}.json",
                    domain,
                    registry,
                    apply=args.apply,
                    overwrite=args.overwrite,
                )
            )

    total_changed = 0
    for report in reports:
        total_changed += int(report["changed"])
        status = "missing" if not report["exists"] else "ok"
        print(
            f"{report['path']}: {status} entries={report['entries']} "
            f"changed={report['changed']} applied={report['applied']}"
        )

    print(f"Total enriched entries: {total_changed}")
    if total_changed and not args.apply:
        print("Dry run only. Re-run with --apply to write changes.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
