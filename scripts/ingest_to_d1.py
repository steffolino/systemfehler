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


def main():
    parser = argparse.ArgumentParser(description='Ingest snapshot entries into D1')
    parser.add_argument('--domain', required=True, help='Domain name (e.g. benefits)')
    parser.add_argument('--snapshot', required=True, help='Path to entries JSON snapshot')
    parser.add_argument(
        '--chunk-size',
        type=int,
        default=0,
        help='Optional chunk size for entries per request (0 = send all at once)',
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
        payload = json.dumps({'domain': args.domain, 'entries': batch}).encode()
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
                f"{prefix}Ingest ok: upserted={body.get('upserted', '?')} skipped={body.get('skipped', '?')}"
            )

    chunk_size = max(0, int(args.chunk_size or 0))
    if chunk_size <= 0:
        try:
            send_batch(entries)
        except urllib.error.HTTPError as e:
            print(f'Ingest failed: HTTP {e.code} {e.reason}', file=sys.stderr)
            print(e.read().decode(), file=sys.stderr)
            sys.exit(1)
    else:
        total_batches = (len(entries) + chunk_size - 1) // chunk_size
        for i in range(total_batches):
            batch = entries[i * chunk_size:(i + 1) * chunk_size]
            try:
                send_batch(batch, i + 1, total_batches)
            except urllib.error.HTTPError as e:
                print(f'Ingest failed in batch {i + 1}/{total_batches}: HTTP {e.code} {e.reason}', file=sys.stderr)
                print(e.read().decode(), file=sys.stderr)
                sys.exit(1)


if __name__ == '__main__':
    main()
