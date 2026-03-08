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

def query_entries(query: str, domain: str = None):
    try:
        session = SessionLocal()
        # Use raw SQL for guaranteed retrieval
        sql = """
        SELECT * FROM entries
        WHERE (
            title_de ILIKE :q OR title_en ILIKE :q OR
            summary_de ILIKE :q OR summary_en ILIKE :q OR
            content_de ILIKE :q OR content_en ILIKE :q
        )
        """
        params = {"q": f"%{query}%"}
        if domain:
            sql += " AND domain = :domain"
            params["domain"] = domain
        results = session.execute(sql, params).fetchall()
        print(f"DEBUG: Found {len(results)} entries for query '{query}' (raw SQL)")
        for r in results:
            print(f"DEBUG ENTRY: {dict(r)}")
        session.close()
        # Convert SQLAlchemy Row objects to dict
        return [dict(r) for r in results]
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
    except jsonschema.ValidationError:
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
