import sqlite3
import sys
from datetime import datetime
import json

def normalize_entry(row):
    # Heuristic normalization
    lang = row['language'] or 'de'
    return {
        'id': row['id'],
        'url': row['url'],
        'source_domain': row['source_domain'],
        'type': 'benefit',
        'title_de': row['title'] if lang == 'de' else None,
        'title_en': row['title'] if lang == 'en' else None,
        'summary_de': row['summary'] if lang == 'de' else None,
        'summary_en': row['summary'] if lang == 'en' else None,
        'topic': row['topic'],
        'language': lang,
        'updatedAt': datetime.utcnow().isoformat(),
        'content': row['content'],
        'summary': row['summary'],
        'keywords': row['keywords'],
    }

def main(db_path):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    # 1. Read from staging_entry
    cur.execute('SELECT * FROM staging_entry')
    rows = cur.fetchall()
    print(f"[ETL DEBUG] fetched {len(rows)} rows from staging_entry")
    for row in rows:
        print(f"[ETL DEBUG] staging_entry row: {dict(row)}")
        norm = normalize_entry(row)
        try:
            cur.execute('''
                INSERT OR REPLACE INTO benefit
                (id, url, source_domain, type, title_de, title_en, summary_de, summary_en, topic, language, updatedAt, content, summary, keywords)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                norm['id'], norm['url'], norm['source_domain'], norm['type'], norm['title_de'], norm['title_en'], norm['summary_de'], norm['summary_en'],
                norm['topic'], norm['language'], norm['updatedAt'], norm['content'], norm['summary'], norm['keywords']
            ))
        except Exception as e:
            print(f"[ETL ERROR] benefit insert failed for id={norm['id']}: {e}")
        try:
            cur.execute('''
                INSERT OR REPLACE INTO search_doc
                (id, url, title, summary, topic, language, content, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                norm['id'], norm['url'], norm['title_de'] or norm['title_en'], norm['summary'], norm['topic'], norm['language'], norm['content'], norm['updatedAt']
            ))
        except Exception as e:
            print(f"[ETL ERROR] search_doc insert failed for id={norm['id']}: {e}")
    conn.commit()
    conn.close()

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('Usage: python etl.py <db_path>')
        sys.exit(1)
    main(sys.argv[1])
