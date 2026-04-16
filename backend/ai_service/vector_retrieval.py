"""
Vector retrieval layer for the AI sidecar.

Provides hybrid retrieval: Qdrant semantic search (document corpus)
fused with Postgres ILIKE results via Reciprocal Rank Fusion (RRF).

The result is a unified ranked list of Evidence objects passed to synthesis.

Env vars:
  OLLAMA_BASE_URL       default: http://localhost:11434
  OLLAMA_EMBED_MODEL    default: nomic-embed-text
  QDRANT_URL            default: http://localhost:6333
  RAG_ENABLED           default: "true"  – set "false" to disable vector retrieval
  RAG_VECTOR_WEIGHT     default: 0.6
  RAG_KEYWORD_WEIGHT    default: 0.4
  RAG_VECTOR_LIMIT      default: 8       – chunks to fetch from Qdrant
  RAG_CONTEXT_LIMIT     default: 5       – fused results sent to LLM
"""

from __future__ import annotations

import json
import os
from typing import Any

from .schemas import Evidence


# ---------------------------------------------------------------------------
# RRF helpers
# ---------------------------------------------------------------------------

def _rrf_score(rank: int, k: int = 60) -> float:
    return 1.0 / (k + rank + 1)


def _rrf_fuse(
    keyword_results: list[dict],
    vector_results: list[dict],
    keyword_weight: float = 0.4,
    vector_weight: float = 0.6,
    key_fn_kw=None,
    key_fn_vec=None,
) -> list[tuple[float, dict]]:
    """
    Fuse two ranked lists via Reciprocal Rank Fusion.

    Items appearing in both lists get combined scores.
    Returns [(fused_score, item)] sorted descending.
    """
    if key_fn_kw is None:
        def key_fn_kw(item):
            return str(item.get("id") or item.get("url") or item.get("chunk_id") or "")
    if key_fn_vec is None:
        def key_fn_vec(item):
            return str(item.get("url") or item.get("chunk_id") or "")

    scores: dict[str, float] = {}
    items: dict[str, dict] = {}

    for rank, item in enumerate(keyword_results):
        key = key_fn_kw(item)
        if not key:
            continue
        scores[key] = scores.get(key, 0.0) + _rrf_score(rank) * keyword_weight
        if key not in items:
            items[key] = {**item, "_origin": "keyword"}

    for rank, item in enumerate(vector_results):
        key = key_fn_vec(item)
        if not key:
            continue
        raw = float(item.get("raw_score") or item.get("source_weight") or 0.0)
        scores[key] = scores.get(key, 0.0) + (_rrf_score(rank) + raw * 0.25) * vector_weight
        if key not in items:
            items[key] = {**item, "_origin": "vector"}
        else:
            items[key]["_origin"] = "hybrid"

    return sorted(
        [(scores[k], items[k]) for k in scores if k in items],
        key=lambda kv: kv[0],
        reverse=True,
    )


# ---------------------------------------------------------------------------
# Qdrant client (lazy singleton)
# ---------------------------------------------------------------------------

_indexer: Any = None


def _get_indexer():
    global _indexer
    if _indexer is not None:
        return _indexer
    try:
        from crawlers.rag.index_docs import RagIndexer
        _indexer = RagIndexer()
    except Exception:
        _indexer = None
    return _indexer


def _is_rag_enabled() -> bool:
    return os.getenv("RAG_ENABLED", "true").strip().lower() not in ("false", "0", "no")


# ---------------------------------------------------------------------------
# Reranking – source trust + knowledge layer from the new schema
# ---------------------------------------------------------------------------

_TRUST_WEIGHTS: dict[str, float] = {
    "tier_1_law": 1.8,
    "tier_2_official": 1.5,
    "tier_3_ngo": 1.0,
    "tier_4_other": 0.7,
}
_LAYER_WEIGHTS: dict[str, float] = {
    "law": 1.6,
    "official_guidance": 1.4,
    "administrative_practice": 1.2,
    "case_law": 1.1,
    "ngo_guidance": 0.9,
    "unknown": 0.7,
}


def _content_length_factor(text: str) -> float:
    n = len(text.strip())
    if n < 60:
        return 0.72
    if n < 140:
        return 0.88
    return 1.0


def _token_overlap(query: str, candidate: str) -> float:
    stop = {
        "der", "die", "das", "ein", "eine", "und", "oder", "mit", "von",
        "im", "in", "an", "auf", "zu", "ist", "es", "ich", "sie", "wir",
    }
    q_tokens = {t for t in query.lower().split() if len(t) >= 3 and t not in stop}
    c_tokens = {t for t in candidate.lower().split() if len(t) >= 3 and t not in stop}
    if not q_tokens:
        return 0.0
    return len(q_tokens & c_tokens) / len(q_tokens)


def rerank_vector_results(query: str, records: list[dict]) -> list[dict]:
    """
    Rerank Qdrant results by:
      - stored source_weight (from index payload, computed at ingest time), OR
      - source_trust_level × knowledge_layer weights (fallback for unweighted items)
      - content length factor
      - query token overlap
    """
    scored: list[tuple[float, dict]] = []
    for rec in records:
        raw = float(rec.get("raw_score", 0.0))

        stored_weight = float(rec.get("source_weight") or 0.0)
        if stored_weight > 0:
            sw = stored_weight
        else:
            trust = _TRUST_WEIGHTS.get(rec.get("source_trust_level", ""), 1.0)
            layer = _LAYER_WEIGHTS.get(rec.get("knowledge_layer", ""), 0.7)
            sw = trust * layer / 2.0  # centre around ~1.0

        cf = _content_length_factor(rec.get("text", ""))
        title_overlap = _token_overlap(query, rec.get("title", ""))
        text_overlap = _token_overlap(query, rec.get("text", ""))
        final = raw * sw * cf + title_overlap * 0.35 + text_overlap * 0.15

        scored.append((final, {**rec, "final_score": final}))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [r for _, r in scored]


# ---------------------------------------------------------------------------
# Evidence conversion helpers
# ---------------------------------------------------------------------------

def _structured_entry_to_evidence(entry: dict, score: float) -> Evidence:
    return Evidence(
        source="db",
        content=json.dumps(entry),
        confidence=min(1.0, max(0.0, score)),
    )


def _rag_chunk_to_evidence(chunk: dict, score: float) -> Evidence:
    payload = {
        "id": chunk.get("chunk_id", ""),
        "title": chunk.get("title", ""),
        "url": chunk.get("url", ""),
        "summary": {"de": (chunk.get("text") or "")[:600]},
        "content": {"de": chunk.get("text", "")},
        "topics": chunk.get("topics", []),
        "domain": chunk.get("document_type", ""),
        "status": "active",
        "provenance": {
            "source": chunk.get("url", ""),
            "source_name": chunk.get("source_name", "") or chunk.get("source_id", ""),
            "source_trust_level": chunk.get("source_trust_level", ""),
            "knowledge_layer": chunk.get("knowledge_layer", ""),
            "document_type": chunk.get("document_type", ""),
            "section_title": chunk.get("section_title", ""),
            "publication_date": chunk.get("publication_date", ""),
            "license_or_rights": chunk.get("license_or_rights", ""),
        },
    }
    return Evidence(
        source="rag",
        content=json.dumps(payload),
        confidence=min(1.0, max(0.0, score)),
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def hybrid_retrieve(
    query: str,
    keyword_entries: list[dict],
    domain: str | None = None,
) -> list[Evidence]:
    """
    Hybrid retrieval: fuse Postgres keyword results with Qdrant vector results.

    Falls back silently to keyword-only if RAG is disabled or Qdrant is unavailable.
    """
    vector_limit = int(os.getenv("RAG_VECTOR_LIMIT", "8"))
    context_limit = int(os.getenv("RAG_CONTEXT_LIMIT", "5"))
    vector_weight = float(os.getenv("RAG_VECTOR_WEIGHT", "0.6"))
    keyword_weight = float(os.getenv("RAG_KEYWORD_WEIGHT", "0.4"))

    vector_results: list[dict] = []
    if _is_rag_enabled():
        indexer = _get_indexer()
        if indexer is not None:
            try:
                raw_chunks = indexer.search(query=query, limit=vector_limit)
                vector_results = rerank_vector_results(query, raw_chunks)
            except Exception as exc:
                print(f"[vector_retrieval] Qdrant unavailable, keyword-only fallback: {exc}")

    if not vector_results:
        return [
            _structured_entry_to_evidence(entry, max(0.1, 1.0 - i * 0.15))
            for i, entry in enumerate(keyword_entries[:context_limit])
        ]

    fused = _rrf_fuse(
        keyword_results=keyword_entries,
        vector_results=vector_results,
        keyword_weight=keyword_weight,
        vector_weight=vector_weight,
        key_fn_kw=lambda e: str(e.get("id") or e.get("url") or ""),
        key_fn_vec=lambda c: str(c.get("url") or c.get("chunk_id") or ""),
    )

    evidence: list[Evidence] = []
    for score, item in fused[:context_limit]:
        if item.get("_origin") in ("keyword", "hybrid") and "id" in item:
            evidence.append(_structured_entry_to_evidence(item, score))
        else:
            evidence.append(_rag_chunk_to_evidence(item, score))

    if not evidence:
        evidence.append(Evidence(source="db", content="No evidence found", confidence=0.0))

    return evidence
