#!/usr/bin/env python3
"""Ingest a domain snapshot into D1 via the Pages ingest endpoint.

Usage:
    python scripts/ingest_to_d1.py --domain benefits --snapshot data/benefits/entries.json

Environment variables (required):
    PAGES_INGEST_URL  Base URL of the Pages deployment (e.g. https://systemfehler.pages.dev)
    INGEST_TOKEN      Bearer token matching the INGEST_TOKEN Pages secret
"""

import argparse
import json
import os
import pathlib
import sys
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from crawlers.shared.source_metadata_enrichment import enrich_entry_source_metadata  # noqa: E402
from crawlers.shared.source_registry import SourceRegistry  # noqa: E402
from crawlers.shared.text_cleaning import clean_entry_text  # noqa: E402

DEFAULT_MAX_BATCH_BYTES = 6_000_000


def make_payload(domain, batch):
    return json.dumps(
        {'domain': domain, 'entries': batch},
        ensure_ascii=False,
        separators=(',', ':'),
    ).encode('utf-8')


def split_batches_by_size(domain, entries, max_entries, max_bytes):
    batches = []
    current = []

    for entry in entries:
        single_payload_size = len(make_payload(domain, [entry]))
        if single_payload_size > max_bytes:
            entry_id = entry.get('id') if isinstance(entry, dict) else None
            raise ValueError(
                f"Entry {entry_id or '<unknown>'} is too large for ingest "
                f"({single_payload_size} bytes > {max_bytes} bytes)."
            )

        candidate = [*current, entry]
        if current and (
            len(candidate) > max_entries or
            len(make_payload(domain, candidate)) > max_bytes
        ):
            batches.append(current)
            current = [entry]
        else:
            current = candidate

    if current:
        batches.append(current)
    return batches


def main():
    parser = argparse.ArgumentParser(description='Ingest snapshot entries into D1')
    parser.add_argument('--domain', required=True, help='Domain name (e.g. benefits)')
    parser.add_argument('--snapshot', required=True, help='Path to entries JSON snapshot')
    parser.add_argument(
        '--chunk-size',
        type=int,
        default=0,
        help='Maximum entries per request (0 = only use byte-based batching)',
    )
    parser.add_argument(
        '--max-bytes',
        type=int,
        default=int(os.environ.get('INGEST_MAX_BATCH_BYTES', DEFAULT_MAX_BATCH_BYTES)),
        help='Maximum JSON payload bytes per request',
    )
    parser.add_argument(
        '--enrich-source-metadata',
        action='store_true',
        help='Fill missing/unknown source metadata from the source registry before upload',
    )
    args = parser.parse_args()

    ingest_url = os.environ.get('PAGES_INGEST_URL', '').rstrip('/') + '/api/admin/ingest'
    token = os.environ.get('INGEST_TOKEN', '')

    if not ingest_url.startswith('http'):
        print('Error: PAGES_INGEST_URL is not set or invalid', file=sys.stderr)
        sys.exit(1)
    if not token:
        print('Error: INGEST_TOKEN is not set', file=sys.stderr)
        sys.exit(1)

    snapshot = pathlib.Path(args.snapshot)
    if not snapshot.exists():
        print(f'Snapshot not found: {snapshot}', file=sys.stderr)
        sys.exit(1)

    entries = json.loads(snapshot.read_text())
    if isinstance(entries, dict):
        nested_entries = entries.get('entries')
        if isinstance(nested_entries, list):
            entries = nested_entries

    if not isinstance(entries, list):
        print('Error: snapshot must be a JSON array or an object with an entries array', file=sys.stderr)
        sys.exit(1)

    if args.enrich_source_metadata:
        registry = SourceRegistry(ROOT / 'data')
        enriched = 0
        for entry in entries:
            if isinstance(entry, dict) and enrich_entry_source_metadata(entry, args.domain, registry):
                enriched += 1
        print(f'Enriched source metadata before ingest: {enriched}')

    cleaned = 0
    for entry in entries:
        if isinstance(entry, dict) and clean_entry_text(entry):
            cleaned += 1
    print(f'Cleaned text before ingest: {cleaned}')

    # Fix multilingual fields for each entry
    def merge_multilingual(entry, base):
        obj = {}
        for lang in ['de', 'en', 'easy_de']:
            key = f"{base}_{lang}"
            val = entry.get(key)
            if val is not None:
                obj[lang] = val
        return obj if obj else None

    for entry in entries:
        for base in ['title', 'summary', 'content']:
            ml = merge_multilingual(entry, base)
            if ml:
                entry[base] = ml
            for lang in ['de', 'en', 'easy_de']:
                key = f"{base}_{lang}"
                if key in entry:
                    del entry[key]
        # targetGroups -> target_groups
        if 'targetGroups' in entry:
            entry['target_groups'] = entry.pop('targetGroups')

    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json',
        'User-Agent': 'systemfehler-ingest-bot/1.0 (+https://github.com/steffolino/systemfehler)',
    }

    def send_batch(batch, index=None, total=None):
        payload = make_payload(args.domain, batch)
        req = urllib.request.Request(
            ingest_url,
            data=payload,
            headers=headers,
            method='POST',
        )
        with urllib.request.urlopen(req) as resp:
            body = json.loads(resp.read())
            prefix = f"[{index}/{total}] " if index is not None and total is not None else ""
            print(
                f"{prefix}Ingest ok: entries={len(batch)} bytes={len(payload)} "
                f"upserted={body.get('upserted', '?')} skipped={body.get('skipped', '?')}"
            )

    chunk_size = max(0, int(args.chunk_size or 0)) or len(entries) or 1
    max_bytes = max(1024, int(args.max_bytes or DEFAULT_MAX_BATCH_BYTES))
    try:
        batches = split_batches_by_size(args.domain, entries, chunk_size, max_bytes)
    except ValueError as e:
        print(f'Ingest failed before upload: {e}', file=sys.stderr)
        sys.exit(1)

    total_batches = len(batches)
    for i, batch in enumerate(batches, start=1):
        try:
            send_batch(batch, i, total_batches)
        except urllib.error.HTTPError as e:
            print(f'Ingest failed in batch {i}/{total_batches}: HTTP {e.code} {e.reason}', file=sys.stderr)
            print(e.read().decode(), file=sys.stderr)
            sys.exit(1)


if __name__ == '__main__':
    main()
