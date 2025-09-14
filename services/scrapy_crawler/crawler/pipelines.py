import os, json, re, sqlite3
from datetime import datetime, timezone
from pathlib import Path
from scrapy.exceptions import DropItem

DB_PATH = os.getenv("SQLITE_PATH", "data/systemfehler.db")
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

class NormalizeAndStore:
    def open_spider(self, spider):
        self.conn = sqlite3.connect(DB_PATH)
        self.cur = self.conn.cursor()
        # assume schema.sql has been executed by setup/migration
    def close_spider(self, spider):
        self.conn.commit()
        self.conn.close()

    def process_item(self, item, spider):
        d = item.__dict__.copy() if hasattr(item, '__dict__') else dict(item)
        d = {k: (_clean(v) if isinstance(v,str) else v) for k,v in d.items()}
        for k,v in list(d.items()):
            if isinstance(v, list):
                d[k] = json.dumps(_uniq([_clean(x) for x in v if _clean(x)]), ensure_ascii=False)
        d["updatedAt"] = d.get("updatedAt") or datetime.now(timezone.utc).isoformat()

        # Determine table name
        table = d.pop("_table", None)
        if not table:
            # Fallback: infer from spider name
            if spider.name == "contacts": table = "Contact_Staging"
            elif spider.name == "aid": table = "AidOffer_Staging"
            elif spider.name == "benefits": table = "Benefit_Staging"
            elif spider.name == "tools": table = "Tool_Staging"
            elif spider.name == "meta": table = "Meta_Staging"
            else: raise DropItem("missing _table")
        cols = list(d.keys())
        placeholders = ",".join(["?"]*len(cols))
        sql = f"INSERT OR REPLACE INTO {table} ({','.join(cols)}) VALUES ({placeholders})"
        self.cur.execute(sql, [d[c] for c in cols])
        return item
