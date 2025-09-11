from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional, Dict, Any, Literal
import os
import psycopg
from psycopg.rows import dict_row

DB_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@db:5432/systemfehler")

app = FastAPI(title="Systemfehler Search API", version="0.1.0")

# CORS for Nuxt dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def expand_query(q: str) -> str:
    q_norm = (q or "").lower().strip()
    if not q_norm:
        return q_norm
    syn = {
        "kinderzuschlag": ["kiz", "kinder zuschlag"],
        "kindergeld": ["kinder geld"],
        "bürgergeld": ["alg2", "hartz4"],
        "wohngeld": ["mietzuschuss"],
        "antrag": ["beantragen", "antragsstellung", "anspruch"],
    }
    parts = [q_norm]
    for k, v in syn.items():
        if k in q_norm:
            parts.extend(v)
    parts.append(q_norm.replace("ä","ae").replace("ö","oe").replace("ü","ue").replace("ß","ss"))
    out = []
    for p in parts:
        if p not in out:
            out.append(p)
    return " ".join(out)

@app.get("/healthz")
def health() -> Dict[str, Any]:
    return {"ok": True}

@app.get("/search")
def search(
    q: str = Query("", description="User query"),
    topic: Optional[str] = Query(None),
    lang: Optional[List[str]] = Query(None, alias="language"),
    limit: int = 20,
    offset: int = 0
):
    import logging
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger("search-endpoint")
    q_stripped = (q or "").strip()
    qx = expand_query(q_stripped)
    params: Dict[str, Any] = {"q": q_stripped, "qx": qx, "limit": limit, "offset": offset, "pfx": f"{q_stripped}%"}
    where_parts = []

    # FTS (German) OR trigram OR prefix
    where_parts.append("(tsv_de @@ plainto_tsquery('german', unaccent(%(qx)s))")
    where_parts.append(" title_de %% %(q)s")
    where_parts.append(" unaccent(title_de) ILIKE unaccent(%(pfx)s))")
    where = ["(" + " OR ".join(where_parts) + ")"]

    if topic:
        where.append("topic @> ARRAY[%(topic)s]::text[]")
        params["topic"] = topic
    if lang:
        where.append("language && %(lang)s::text[]")
        params["lang"] = lang

    sql = f"""
    SELECT kind, id, topic, language, title_de, title_en, summary_de, summary_en,
           source_domain, updated_at,
           ts_rank(tsv_de, plainto_tsquery('german', unaccent(%(qx)s)))
           + 0.1 * COALESCE(popularity,0)
           + CASE WHEN source_domain IN ('arbeitsagentur.de','www.arbeitsagentur.de','familienkasse.de','www.familienkasse.de') THEN 0.2 ELSE 0 END
           - EXTRACT(EPOCH FROM (now() - updated_at))/1e8 AS score
    FROM entries_search
    WHERE {' AND '.join(where)}
    ORDER BY score DESC
    LIMIT %(limit)s OFFSET %(offset)s
    """

    logger.info(f"/search called with params: {params}")
    logger.info(f"SQL: {sql}")
    try:
        with psycopg.connect(DB_URL, row_factory=dict_row) as conn:
            # For very short queries, relax trigram similarity
            if len(q_stripped) <= 4:
                conn.execute("SELECT set_limit(0.2);")  # default is ~0.3
            rows = conn.execute(sql, params).fetchall()
        logger.info(f"Returned {len(rows)} rows")
        return {"hits": rows}
    except Exception as e:
        logger.error(f"Error in /search: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/suggest")
def suggest(prefix: str, topic: Optional[str] = None, limit: int = 8):
    where = ["(title_de ILIKE %(pfx)s OR title_de %% %(p)s)"]
    params: Dict[str, Any] = {"p": prefix, "pfx": f"{prefix}%", "limit": limit}    
    if topic:
        where.append("topic @> ARRAY[%(topic)s]::text[]")
        params["topic"] = topic
    sql = f"""
    SELECT kind, id, title_de AS title
    FROM entries_search
    WHERE {' AND '.join(where)}
    ORDER BY similarity(title_de, %(p)s) DESC
    LIMIT %(limit)s
    """
    with psycopg.connect(DB_URL, row_factory=dict_row) as conn:
        rows = conn.execute(sql, params).fetchall()
    return {"suggestions": rows}

def _pick_source_url(conn, kind: str, id: str):
    # Prefer Tool.url for tools; otherwise take the best RelatedLink
    if kind == "tool":
        row = conn.execute('SELECT url FROM "Tool" WHERE id=%(id)s', {"id": id}).fetchone()
        if row and row["url"]:
            return row["url"]
        fk = "toolId"
    elif kind == "benefit":
        fk = "benefitId"
    else:
        fk = "aidOfferId"

    row = conn.execute(
        f'''
        SELECT url
        FROM "RelatedLink"
        WHERE "{fk}" = %(id)s AND COALESCE(status,'') <> 'ignored'
        ORDER BY (COALESCE(relation,'')='official_info') DESC, id
        LIMIT 1
        ''',
        {"id": id},
    ).fetchone()
    return row["url"] if row else None

@app.get("/entry/{kind}/{id}")
def entry(kind: Literal["benefit","tool","aid"], id: str):
    sql_main = """
      SELECT kind, id, topic, language,
             title_de, title_en, summary_de, summary_en,
             source_domain, updated_at,
             COALESCE(popularity,0) AS popularity
      FROM entries_search
      WHERE kind = %(kind)s AND id = %(id)s
      LIMIT 1
    """
    fk = {"benefit": "benefitId", "tool": "toolId", "aid": "aidOfferId"}[kind]
    sql_links = f"""
      SELECT id, url, title, relation, status
      FROM "RelatedLink"
      WHERE "{fk}" = %(id)s AND COALESCE(status,'') <> 'ignored'
      ORDER BY (COALESCE(relation,'')='official_info') DESC, id
    """

    with psycopg.connect(DB_URL, row_factory=dict_row) as conn:
        main = conn.execute(sql_main, {"kind": kind, "id": id}).fetchone()
        if not main:
            # fallback to base table so details still load even if MV missed it
            table = {"benefit": '"Benefit"', "tool": '"Tool"', "aid": '"AidOffer"'}[kind]
            base = conn.execute(f"""
                SELECT
                  %(kind)s::text AS kind,
                  id, topic, language, title_de, title_en, summary_de, summary_en,
                  NULL::text AS source_domain,
                  "updatedAt"::timestamptz AS updated_at,
                  0.0 AS popularity
                FROM {table}
                WHERE id = %(id)s
                """, {"kind": kind, "id": id}).fetchone()
            if not base:
                raise HTTPException(status_code=404, detail="not found")
            main = base

        # add source_url + links
        main["source_url"] = _pick_source_url(conn, kind, id)
        main["links"] = conn.execute(sql_links, {"id": id}).fetchall()

    return main


@app.get("/topics")
def topics(limit: int = 20):
    """
    Return topics with total counts and kind breakdown. Drives the nav + landing.
    """
    sql = """
    WITH exploded AS (
      SELECT unnest(topic) AS topic, kind
      FROM entries_search
    )
    SELECT topic,
           COUNT(*) AS total,
           COUNT(*) FILTER (WHERE kind = 'benefit') AS benefit,
           COUNT(*) FILTER (WHERE kind = 'tool')    AS tool,
           COUNT(*) FILTER (WHERE kind = 'aid')     AS aid
    FROM exploded
    GROUP BY topic
    ORDER BY total DESC
    LIMIT %(limit)s
    """
    with psycopg.connect(DB_URL, row_factory=dict_row) as conn:
        rows = conn.execute(sql, {"limit": limit}).fetchall()
    return {"topics": rows}
