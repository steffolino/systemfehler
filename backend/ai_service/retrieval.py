"""
Retrieval-first answer pipeline
- Structured data is source of truth
- LLM only for synthesis
"""

from .schemas import Evidence
import json
import os
import jsonschema


# ORM database access layer
from .db import SessionLocal, Entry
from sqlalchemy import text

import datetime

def _serialize_datetimes(obj):
    # Recursively convert datetime/date objects to ISO strings, leave None untouched
    if isinstance(obj, dict):
        return {k: _serialize_datetimes(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_serialize_datetimes(v) for v in obj]
    elif isinstance(obj, (datetime.datetime, datetime.date)):
        return obj.isoformat()
    else:
        return obj

def query_entries(query: str, domain: str = None):
    try:
        session = SessionLocal()
        # Use raw SQL for guaranteed retrieval
        sql = """
        SELECT * FROM entries
        WHERE (
            title_de ILIKE :q OR title_en ILIKE :q OR title_easy_de ILIKE :q OR
            summary_de ILIKE :q OR summary_en ILIKE :q OR summary_easy_de ILIKE :q OR
            content_de ILIKE :q OR content_en ILIKE :q OR content_easy_de ILIKE :q
        )
        """
        params = {"q": f"%{query}%"}
        if domain:
            sql += " AND domain = :domain"
            params["domain"] = domain
        sql += """
        ORDER BY
            CASE COALESCE(provenance->>'sourceTier', 'tier_unknown')
                WHEN 'tier_1_official' THEN 0
                WHEN 'tier_2_ngo_watchdog' THEN 1
                WHEN 'tier_4_academic' THEN 2
                WHEN 'tier_3_press' THEN 3
                ELSE 4
            END,
            COALESCE((quality_scores->>'ais')::numeric, 0) DESC,
            COALESCE((quality_scores->>'iqs')::numeric, 0) DESC,
            last_seen DESC NULLS LAST,
            created_at DESC NULLS LAST
        """
        results = session.execute(text(sql), params).mappings().all()
        print(f"DEBUG: Found {len(results)} entries for query '{query}' (raw SQL)")
        for r in results:
            print(f"DEBUG ENTRY: {dict(r)}")
        session.close()
        # Always convert id to string UUID (no objects) and serialize datetimes
        out = []
        for r in results:
            d = dict(r)
            if 'id' in d and d['id'] is not None:
                d['id'] = str(d['id'])
            d = _serialize_datetimes(d)
            out.append(d)
        return out
    except Exception as e:
        print(f"DB error: {e}")
        return []

def load_core_schema():
    schema_path = os.path.join(os.path.dirname(__file__), '../../data/_schemas/core.schema.json')
    with open(schema_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def validate_entry(entry):
    schema = load_core_schema()
    try:
        jsonschema.validate(instance=entry, schema=schema)
        return True
    except jsonschema.ValidationError as e:
        print("[VALIDATION ERROR]", e)
        print("[INVALID ENTRY]", entry)
        return False

def retrieve_evidence(query: str, domain: str = None) -> list:
    results = query_entries(query, domain)
    evidence = []
    for entry in results:
        if validate_entry(entry):
            evidence.append(Evidence(source="db", content=json.dumps(entry), confidence=0.95))
    if not evidence:
        evidence.append(Evidence(source="db", content="No evidence found", confidence=0.0))
    return evidence
