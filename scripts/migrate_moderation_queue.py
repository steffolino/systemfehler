#!/usr/bin/env python3
"""Migrate moderation/review_queue.json to canonical moderation queue format.

Usage:
    python scripts/migrate_moderation_queue.py
    python scripts/migrate_moderation_queue.py --dry-run
    python scripts/migrate_moderation_queue.py --queue-path moderation/review_queue.json
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Tuple

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from crawlers.shared.moderation_queue import (
    canonicalize_queue_entry,
    validate_queue_entry,
)


def _utc_stamp() -> str:
    return datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')


def _load_payload(queue_path: Path) -> Any:
    if not queue_path.exists():
        return []

    raw = queue_path.read_text(encoding='utf-8').strip()
    if not raw:
        return []

    return json.loads(raw)


def _extract_items(payload: Any) -> List[Dict[str, Any]]:
    if isinstance(payload, dict):
        raw_items = payload.get('queue', [])
    elif isinstance(payload, list):
        raw_items = payload
    else:
        raw_items = []

    return [item for item in raw_items if isinstance(item, dict)]


def _dedupe(items: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], int]:
    seen: set[str] = set()
    deduped: List[Dict[str, Any]] = []

    for item in items:
        fingerprint = json.dumps(item, ensure_ascii=False, sort_keys=True)
        if fingerprint in seen:
            continue
        seen.add(fingerprint)
        deduped.append(item)

    return deduped, len(items) - len(deduped)


def migrate(queue_path: Path) -> Dict[str, int]:
    payload = _load_payload(queue_path)
    raw_items = _extract_items(payload)

    migrated: List[Dict[str, Any]] = []
    invalid_count = 0

    for raw in raw_items:
        candidate = canonicalize_queue_entry(raw)
        errors = validate_queue_entry(candidate)
        if errors:
            invalid_count += 1
            continue
        migrated.append(candidate)

    deduped, duplicate_count = _dedupe(migrated)

    return {
        'raw_count': len(raw_items),
        'migrated_count': len(migrated),
        'invalid_count': invalid_count,
        'duplicate_count': duplicate_count,
        'final_count': len(deduped),
        'payload': deduped,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description='Migrate moderation queue to canonical format')
    parser.add_argument(
        '--queue-path',
        default='moderation/review_queue.json',
        help='Path to moderation queue JSON file',
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Analyze and print counts without writing files',
    )
    parser.add_argument(
        '--no-backup',
        action='store_true',
        help='Do not create timestamped .bak file before writing',
    )
    args = parser.parse_args()

    queue_path = Path(args.queue_path)
    result = migrate(queue_path)

    print(f"Queue items (raw): {result['raw_count']}")
    print(f"Valid after canonicalization: {result['migrated_count']}")
    print(f"Invalid dropped: {result['invalid_count']}")
    print(f"Exact duplicates removed: {result['duplicate_count']}")
    print(f"Final items: {result['final_count']}")

    if args.dry_run:
        print('Dry run: no files were changed.')
        return 0

    queue_path.parent.mkdir(parents=True, exist_ok=True)

    if queue_path.exists() and not args.no_backup:
        backup_path = queue_path.with_suffix(f"{queue_path.suffix}.{_utc_stamp()}.bak")
        shutil.copy2(queue_path, backup_path)
        print(f"Backup written: {backup_path}")

    queue_path.write_text(
        json.dumps(result['payload'], ensure_ascii=False, indent=2) + '\n',
        encoding='utf-8',
    )
    print(f"Migrated queue written: {queue_path}")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
