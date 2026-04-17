"""
Source registry loader for the systemfehler RAG pipeline.

All source definitions live in data/_rag_sources/source_registry.json.
This module loads, validates, and exposes them as RagSource objects.

Do NOT hardcode source entries here. Edit source_registry.json instead.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from pydantic import ValidationError

from .schemas import (
    DocumentType,
    KnowledgeLayer,
    RagSource,
    SourceTrustLevel,
)

# ---------------------------------------------------------------------------
# Source weight tables (used for RRF reranking)
# ---------------------------------------------------------------------------

_TRUST_WEIGHTS: dict[str, float] = {
    SourceTrustLevel.TIER_1_LAW: 1.8,
    SourceTrustLevel.TIER_2_OFFICIAL: 1.5,
    SourceTrustLevel.TIER_3_NGO: 1.0,
    SourceTrustLevel.TIER_4_OTHER: 0.7,
}

_DOCTYPE_WEIGHTS: dict[str, float] = {
    DocumentType.STATUTE: 1.4,
    DocumentType.MERKBLATT: 1.5,
    DocumentType.WEISUNG: 1.4,
    DocumentType.BROSCHUERE: 1.1,
    DocumentType.FORMULAR: 1.0,
    DocumentType.FAQ: 1.0,
    DocumentType.GUIDE: 0.9,
    DocumentType.WEBSITE: 0.8,
    DocumentType.OTHER: 0.7,
}

# ---------------------------------------------------------------------------
# Topic-keyword → boosted (document_types, topics) rules
#
# When a query contains any of the trigger keywords, chunks whose
# document_type OR topics match the rule get their final score multiplied
# by `boost`. Rules are checked in order; all matching boosts are applied.
# ---------------------------------------------------------------------------

TOPIC_BOOST_RULES: list[dict] = [
    {
        "keywords": ["kindergeld", "familienkasse", "beantragen", "antrag"],
        "document_types": ["formular"],
        "topics": ["family", "child_benefit"],
        "boost": 1.6,
    },
    {
        "keywords": ["sanktion", "leistungsminderung", "meldeversäumnis", "pflichtverletzung"],
        "document_types": ["weisung"],
        "topics": ["sanctions"],
        "boost": 1.35,
    },
    {
        "keywords": ["unterkunft", "kdu", "miete", "wohnen", "heizung", "angemessen"],
        "document_types": ["weisung"],
        "topics": ["housing"],
        "boost": 1.35,
    },
    {
        "keywords": ["bürgergeld", "sgb ii", "grundsicherung", "alg ii", "arbeitslosengeld ii"],
        "document_types": ["statute", "merkblatt", "weisung"],
        "topics": ["financial_support", "employment"],
        "boost": 1.2,
    },
    {
        "keywords": ["arbeitslosengeld", "alg i", "sgb iii", "arbeitslos"],
        "document_types": ["statute", "merkblatt"],
        "topics": ["employment"],
        "boost": 1.2,
    },
    {
        "keywords": ["kindergeld", "familienkasse", "kind"],
        "document_types": ["formular", "merkblatt"],
        "topics": ["family", "child_benefit"],
        "boost": 1.2,
    },
    {
        "keywords": ["widerspruch", "klage", "rechtsmittel", "bescheid", "ablehnung"],
        "document_types": ["statute", "weisung", "guide"],
        "topics": ["legal_remedies", "financial_support"],
        "boost": 1.3,
    },
    {
        "keywords": ["erwerbsfähigkeit", "arbeitsunfähig", "krankheit", "reha"],
        "document_types": ["weisung", "statute"],
        "topics": ["health", "rehabilitation"],
        "boost": 1.25,
    },
    {
        "keywords": ["nebeneinkommen", "hinzuverdienst", "freibetrag", "einkommen"],
        "document_types": ["weisung", "merkblatt", "statute"],
        "topics": ["financial_support", "employment"],
        "boost": 1.25,
    },
]


def topic_boost_for_query(query: str, chunk_payload: dict) -> float:
    """
    Return a combined topic boost multiplier for a chunk given a query string.
    Multiplies all matching rule boosts together (capped at 2.0).
    """
    q = query.lower()
    doc_type = (chunk_payload.get("document_type") or "").lower()
    topics: list[str] = chunk_payload.get("topics") or []

    combined = 1.0
    for rule in TOPIC_BOOST_RULES:
        if not any(kw in q for kw in rule["keywords"]):
            continue
        type_match = doc_type in rule["document_types"]
        topic_match = any(t in topics for t in rule["topics"])
        if type_match or topic_match:
            combined *= rule["boost"]

    return min(combined, 2.0)


def compute_source_weight(source: RagSource) -> float:
    trust = _TRUST_WEIGHTS.get(source.source_trust_level, 1.0)
    dtype = _DOCTYPE_WEIGHTS.get(source.document_type, 1.0)
    return round(trust * dtype, 3)


# ---------------------------------------------------------------------------
# Registry loader
# ---------------------------------------------------------------------------

def _registry_path() -> Path:
    return (
        Path(__file__).resolve().parents[2]
        / "data"
        / "_rag_sources"
        / "source_registry.json"
    )


@lru_cache(maxsize=1)
def load_registry() -> list[RagSource]:
    """Load and validate all sources from source_registry.json."""
    path = _registry_path()
    if not path.exists():
        raise FileNotFoundError(f"Source registry not found: {path}")

    raw = json.loads(path.read_text(encoding="utf-8"))
    entries = raw.get("sources", []) if isinstance(raw, dict) else []

    sources: list[RagSource] = []
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        try:
            source = RagSource.model_validate(entry)
            source.source_weight = compute_source_weight(source)
            sources.append(source)
        except ValidationError as exc:
            print(f"[source_registry] Skipping invalid entry '{entry.get('id')}': {exc}")

    return sources


def get_source(source_id: str) -> RagSource | None:
    return next((s for s in load_registry() if s.id == source_id), None)


def sources_by_topic(topic: str) -> list[RagSource]:
    return [s for s in load_registry() if topic in s.topics]


def sources_by_trust_level(level: SourceTrustLevel) -> list[RagSource]:
    return [s for s in load_registry() if s.source_trust_level == level]


def invalidate_cache() -> None:
    """Force re-read of the registry (useful in tests)."""
    load_registry.cache_clear()
