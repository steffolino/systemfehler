
import json, sqlite3, sys
from datetime import datetime, timezone
from pathlib import Path

DB = Path(sys.argv[1] if len(sys.argv) > 1 else "data/systemfehler.db")

def jloads(s): return json.loads(s) if s else []
def now(): return datetime.now(timezone.utc).isoformat()

with sqlite3.connect(DB, timeout=30) as con:
    cur = con.cursor()

    # Ensure SearchDoc table exists
    cur.execute("""
        CREATE TABLE IF NOT EXISTS SearchDoc (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            title TEXT,
            subtitle TEXT,
            url TEXT,
            text TEXT,
            topics TEXT,
            languages TEXT,
            org_id TEXT,
            updatedAt TEXT NOT NULL
        )
    """)

    # Upsert Benefit (from Benefit_Staging to aid_offer)
    cur.execute("""INSERT OR REPLACE INTO aid_offer(id,url,title_de,title_en,summary_de,summary_en,topic,language,content,summary,keywords,updatedAt)
        SELECT id,url,title_de,title_en,summary_de,summary_en,topic,language,content,summary,keywords,updatedAt FROM Benefit_Staging
    """)

    # Upsert Organization
    cur.execute("""INSERT OR REPLACE INTO organization(id,name,domain,url,description_de,description_en,content,summary,keywords,updatedAt)
        SELECT id,name,domain,url,description_de,description_en,content,summary,keywords,updatedAt FROM Organization_Staging
    """)

    # Upsert Contact
    cur.execute("""INSERT OR REPLACE INTO contact(id,organization_id,email,phone,address,opening_hours,source_url,last_seen,tags,content,summary,keywords,updatedAt)
        SELECT id,org_id,emails,phones,NULL,opening_hours,url,updatedAt,notes,content,summary,keywords,updatedAt FROM Contact_Staging
    """)

    # Upsert AidOffer
    cur.execute("""INSERT OR REPLACE INTO aid_offer(id,url,title_de,title_en,summary_de,summary_en,topic,language,content,summary,keywords,updatedAt)
        SELECT id,url,title_de,title_en,summary_de,summary_en,topic,language,content,summary,keywords,updatedAt FROM AidOffer_Staging
    """)

    # Rebuild SearchDoc (simple deterministic pass)
    cur.execute("DELETE FROM SearchDoc")

    # Orgs
    for (id,name,domain,url,desc_de,desc_en,updatedAt) in cur.execute(
        "SELECT id,name,domain,url,description_de,description_en,updatedAt FROM Organization"
    ):
        # Insert topics and languages from staging into junction tables
        staging = con.execute("SELECT topics, languages FROM Organization_Staging WHERE id=?", (id,)).fetchone()
        topic_codes = json.loads(staging[0]) if staging and staging[0] else []
        lang_codes = json.loads(staging[1]) if staging and staging[1] else []
        for t in topic_codes:
            cur.execute("INSERT OR IGNORE INTO organization_topic (organization_id, topic_code) VALUES (?, ?)", (id, t))
        for l in lang_codes:
            cur.execute("INSERT OR IGNORE INTO organization_language (organization_id, language_code) VALUES (?, ?)", (id, l))
        text = " ".join([x for x in [name, domain, url, (desc_de or ""), (desc_en or "")] if x])
        cur.execute("""INSERT OR REPLACE INTO SearchDoc
            (id,type,title,subtitle,url,text,topics,languages,org_id,updatedAt)
            VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (id,"org",name,domain,url,text,json.dumps(topic_codes),json.dumps(lang_codes),None,updatedAt))

    # Contacts
    for (id,organization_id,name,email,phone,address,opening_hours,source_url,last_seen,tags,updatedAt) in cur.execute(
        "SELECT id,organization_id,name,email,phone,address,opening_hours,source_url,last_seen,tags,updatedAt FROM contact"
    ):
        subtitle = organization_id
        text = " ".join([str(name or ""), str(email or ""), str(phone or ""), str(address or ""), str(opening_hours or ""), str(tags or ""), str(source_url or ""), str(last_seen or "")])
        cur.execute("""INSERT OR REPLACE INTO SearchDoc
            (id,type,title,subtitle,url,text,topics,languages,org_id,updatedAt)
            VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (id,"contact","Kontakt",subtitle,source_url,text,"[]","[]",organization_id,updatedAt))

    # Aid
    for (id,url,td,te,sd,se,topic,lang,updatedAt) in cur.execute(
        "SELECT id,url,title_de,title_en,summary_de,summary_en,topic,language,updatedAt FROM aid_offer"
    ):
        title = td or te or "Angebot"
        text = " ".join([td or "", te or "", sd or "", se or "", url])
        cur.execute("""INSERT OR REPLACE INTO SearchDoc
            (id,type,title,subtitle,url,text,topics,languages,org_id,updatedAt)
            VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (id,"aid",title,None,url,text,topic or "[]",lang or "[]",None,updatedAt))

    print("Transform complete.")
