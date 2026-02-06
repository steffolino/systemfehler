"""Run a translation pilot over available data entries.

Usage: run this script from the project root. It will look for entries in
`data/*/entries.json` and process up to N entries (default 100). Results are
written to `data/pilot_translated.json`.
"""
import json
from pathlib import Path
from crawlers.shared.translations_generator import default_generator


def load_entries(max_entries=100):
    base = Path('data')
    entries = []
    for domain_dir in base.iterdir():
        if not domain_dir.is_dir():
            continue
        file = domain_dir / 'entries.json'
        if not file.exists():
            continue
        try:
            data = json.loads(file.read_text(encoding='utf-8'))
            for e in data.get('entries', []):
                entries.append((domain_dir.name, e))
                if len(entries) >= max_entries:
                    return entries
        except Exception:
            continue
    return entries


def run_pilot(max_entries=100, out_file='data/pilot_translated.json'):
    entries = load_entries(max_entries)
    results = {
        'processed': 0,
        'translated': 0,
        'errors': 0,
        'samples': []
    }

    moderation_queue = []

    for domain, entry in entries:
        try:
            text = entry.get('content', {}).get('de') or entry.get('summary', {}).get('de') or ''
            if not text:
                results['errors'] += 1
                continue
            tg = default_generator.translate(text, 'de-LEICHT')
            entry.setdefault('translations', {})
            entry['translations']['de-LEICHT'] = {
                'title': entry.get('title', {}).get('de', ''),
                'summary': entry.get('summary', {}).get('de', ''),
                'body': tg['text'],
                'provenance': { 'source': entry.get('url',''), 'crawledAt': entry.get('lastSeen','') },
                'method': tg['method'],
                'generator': tg['generator'],
                'timestamp': tg['timestamp'],
                'reviewed': False
            }
            results['processed'] += 1
            results['translated'] += 1
            if len(results['samples']) < 5:
                results['samples'].append({'id': entry.get('id'), 'translation': entry['translations']['de-LEICHT']})
            # Add moderation queue item
            moderation_queue.append({
                'domain': domain,
                'entry_id': entry.get('id'),
                'source': entry.get('url',''),
                'original_text': text,
                'translation_text': tg['text'],
                'method': tg['method'],
                'generator': tg['generator'],
                'timestamp': tg['timestamp'],
                'status': 'pending'
            })
        except Exception:
            results['errors'] += 1

    # Write results
    outp = { 'meta': { 'processed': results['processed'], 'translated': results['translated'], 'errors': results['errors'] }, 'samples': results['samples'] }
    Path(out_file).write_text(json.dumps(outp, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f"Pilot complete. Processed={results['processed']} Translated={results['translated']} Errors={results['errors']}")
    # Write moderation queue
    mq_path = Path('moderation')
    mq_path.mkdir(exist_ok=True)
    mq_file = mq_path / 'review_queue.json'
    if mq_file.exists():
        try:
            existing = json.loads(mq_file.read_text(encoding='utf-8'))
        except Exception:
            existing = []
    else:
        existing = []
        # annotate items with status
        for it in moderation_queue:
            it.setdefault('status', 'pending')
        existing.extend(moderation_queue)
    mq_file.write_text(json.dumps(existing, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f"Wrote moderation queue with {len(moderation_queue)} items to {mq_file}")


if __name__ == '__main__':
    run_pilot()
