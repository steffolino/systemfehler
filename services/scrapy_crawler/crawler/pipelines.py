import os, json, re, sqlite3, logging
from datetime import datetime, timezone
from pathlib import Path
from scrapy.exceptions import DropItem

def _ensure_table(con):
    cur = con.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='staging_entry';")
    if not cur.fetchone():
        raise RuntimeError("staging_entry not found in DB. Check schema initialization and SF_SQLITE path.")

DB_PATH = os.getenv("SF_SQLITE", os.getenv("SQLITE_PATH", "data/systemfehler.db"))
Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)

def _clean(s):
    if not s: return None
    return re.sub(r"\s+"," ",str(s)).strip() or None

def _uniq(xs):
    out, seen = [], set()
    for x in xs or []:
        if x and x not in seen:
            out.append(x); seen.add(x)
    return out


import hashlib


class NormalizeAndStore:
    @classmethod
    def from_crawler(cls, crawler):
        inst = cls()
        logging.getLogger(__name__).setLevel(logging.INFO)
        logging.info(f"[PIPELINE] ENV SF_SQLITE={os.getenv('SF_SQLITE')} SQLITE_PATH={os.getenv('SQLITE_PATH')}")
        return inst

    def open_spider(self, spider):
        self.sqlite_path = os.getenv("SF_SQLITE", os.getenv("SQLITE_PATH", "data/systemfehler.db"))
        self.sqlite_path = os.path.abspath(self.sqlite_path)
        logging.info(f"[PIPELINE] Using SQLite path: {self.sqlite_path}")
        os.makedirs(os.path.dirname(self.sqlite_path), exist_ok=True)
        self.conn = sqlite3.connect(self.sqlite_path)
        self.conn.execute("PRAGMA journal_mode=WAL;")
        self.conn.execute("PRAGMA foreign_keys=ON;")
        _ensure_table(self.conn)
        self.cur = self.conn.cursor()

    def close_spider(self, spider):
        self.conn.commit()
        self.conn.close()

    def process_item(self, item, spider):
        logging.info(f"[PIPELINE] Upserting into SQLite: {self.sqlite_path}")
        d = item.__dict__.copy() if hasattr(item, '__dict__') else dict(item)
        d = {k: (_clean(v) if isinstance(v,str) else v) for k,v in d.items()}
        for k,v in list(d.items()):
            if isinstance(v, list):
                d[k] = json.dumps(_uniq([_clean(x) for x in v if _clean(x)]), ensure_ascii=False)

        # Fill required fields for staging_entry
        d['category'] = d.get('category') or getattr(spider, 'category', None)
        d['source_url'] = d.get('source_url') or d.get('url')
        d['source_domain'] = d.get('source_domain') or d.get('domain')
        d['first_seen'] = d.get('first_seen') or datetime.now(timezone.utc).isoformat()
        d['last_seen'] = datetime.now(timezone.utc).isoformat()
        # ID: sha256(source_domain + '|' + source_url)
        id_input = (d.get('source_domain','') + '|' + d.get('source_url','')).encode('utf-8')
        d['id'] = hashlib.sha256(id_input).hexdigest()
        # Checksum: sha256(JSON.stringify(payload sorted))
        payload = d.get('payload') or json.dumps(d, sort_keys=True, ensure_ascii=False)
        d['checksum'] = hashlib.sha256(payload.encode('utf-8')).hexdigest()
        d['payload'] = payload

        cols = [
            'id','category','source_url','source_domain','title','summary','language','topic','content','keywords','payload','first_seen','last_seen','checksum'
        ]
        values = [d.get(c) for c in cols]
        sql = f"INSERT OR REPLACE INTO staging_entry ({','.join(cols)}) VALUES ({','.join(['?']*len(cols))})"
        self.cur.execute(sql, values)
        return item
