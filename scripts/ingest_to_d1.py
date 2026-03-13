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

    payload = json.dumps({'domain': args.domain, 'entries': entries}).encode()
    req = urllib.request.Request(
        ingest_url,
        data=payload,
        headers={
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json',
            'User-Agent': 'systemfehler-ingest-bot/1.0 (+https://github.com/steffolino/systemfehler)',
        },
        method='POST',
    )
    try:
        with urllib.request.urlopen(req) as resp:
            body = json.loads(resp.read())
            print(f"Ingest ok: upserted={body.get('upserted', '?')} skipped={body.get('skipped', '?')}")
    except urllib.error.HTTPError as e:
        print(f'Ingest failed: HTTP {e.code} {e.reason}', file=sys.stderr)
        print(e.read().decode(), file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
