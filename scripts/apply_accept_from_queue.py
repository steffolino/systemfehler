"""Small script to accept the first pending moderation item and apply it to the domain snapshot.

Usage: python scripts/apply_accept_from_queue.py
"""
import json
import os
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QUEUE = os.path.join(ROOT, 'moderation', 'review_queue.json')

def load_queue():
    try:
        with open(QUEUE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return []

def save_queue(q):
    with open(QUEUE, 'w', encoding='utf-8') as f:
        json.dump(q, f, ensure_ascii=False, indent=2)

def apply_item(item):
    domain = item.get('domain')
    entry_id = item.get('entry_id')
    data_dir = os.path.join(ROOT, 'data', domain)
    entries_file = os.path.join(data_dir, 'entries.json')
    if not os.path.exists(entries_file):
        print('Entries file not found for domain', domain)
        return False
    with open(entries_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    # support both top-level list and {'entries': [...]} formats
    if isinstance(data, dict) and 'entries' in data and isinstance(data['entries'], list):
        entries = data['entries']
        container_is_obj = True
    elif isinstance(data, list):
        entries = data
        container_is_obj = False
    else:
        entries = []
        container_is_obj = False
    changed = False
    for e in entries:
        if str(e.get('id')) == str(entry_id):
            tr = e.setdefault('translations', {}).setdefault('de-LEICHT', {})
            tr['reviewed'] = True
            tr['appliedAt'] = datetime.utcnow().isoformat() + 'Z'
            changed = True
    if changed:
        if container_is_obj:
            data['entries'] = entries
            with open(entries_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        else:
            with open(entries_file, 'w', encoding='utf-8') as f:
                json.dump(entries, f, ensure_ascii=False, indent=2)
    return changed

def main():
    q = load_queue()
    for it in q:
        if it.get('status') == 'pending':
            print('Applying item', it.get('entry_id'), 'from domain', it.get('domain'))
            ok = apply_item(it)
            if ok:
                it['status'] = 'accepted'
                it['reviewedAt'] = datetime.utcnow().isoformat() + 'Z'
                save_queue(q)
                print('Applied and marked accepted.')
                return
            else:
                print('No matching entry found; skipping.')
                it['status'] = 'rejected'
                it['reviewedAt'] = datetime.utcnow().isoformat() + 'Z'
                save_queue(q)
                return
    print('No pending items found.')

if __name__ == '__main__':
    main()
