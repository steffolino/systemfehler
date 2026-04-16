"""
Ingest orchestration for the systemfehler RAG pipeline.

Pipeline per source:
  registry → fetch → extract → normalize → chunk → index

Usage:
  from crawlers.rag.ingest import ingest_source, ingest_all

  chunks = ingest_source(source)        # returns list[RagChunk] without indexing
  ingest_all()                          # fetch + index all registry sources
"""

from __future__ import annotations

import hashlib
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

from .extract import extract
from .normalize import normalize, content_hash
from .chunk_docs import chunk_document
from .schemas import (
    DocumentType,
    IngestStatus,
    KnowledgeLayer,
    RagChunk,
    RagDocument,
    RagSource,
    SourceTrustLevel,
)
from .sources import load_registry, compute_source_weight

logger = logging.getLogger(__name__)

# Cache directory for raw fetched content
_CACHE_ROOT = Path(__file__).resolve().parents[2] / "data" / "_rag_cache"

# External PDF corpus directory.
# Evaluated lazily so that RAG_LOCAL_DIR set in .env (loaded by cli.py) is respected.
# Defaults to data/_rag_sources/local/ inside the repo if RAG_LOCAL_DIR is not set.
_DEFAULT_LOCAL_DIR = Path(__file__).resolve().parents[2] / "data" / "_rag_sources" / "local"


def _rag_local_dir() -> Path:
    """Return the resolved local corpus directory (reads env at call time)."""
    val = os.environ.get("RAG_LOCAL_DIR")
    return Path(val) if val else _DEFAULT_LOCAL_DIR


def _resolve_local_path(url: str) -> Path:
    """
    Resolve a local_file registry URL to an absolute path.

    Registry URLs use the form ``data/_rag_sources/local/<filename>``.
    The filename is extracted and joined against RAG_LOCAL_DIR so the
    corpus can live outside the repository.
    """
    return _rag_local_dir() / Path(url).name


# ---------------------------------------------------------------------------
# Document fetch + extract
# ---------------------------------------------------------------------------

def _cache_path(source: RagSource) -> Path:
    slug = hashlib.md5(source.url.encode()).hexdigest()[:12]
    ext = ".pdf" if source.url.lower().endswith(".pdf") else ".txt"
    return _CACHE_ROOT / f"{source.id}_{slug}{ext}"


def _fetch_raw(source: RagSource) -> str:
    """
    Fetch the source, extract text, and cache the result.
    Returns normalized text.
    """
    _CACHE_ROOT.mkdir(parents=True, exist_ok=True)
    cache_file = _cache_path(source)

    if cache_file.exists():
        logger.debug("Cache hit for %s", source.id)
        raw_text = cache_file.read_text(encoding="utf-8", errors="replace")
    else:
        logger.info("Fetching %s  →  %s", source.id, source.url)
        if source.source_type == "local_file":
            resolved = _resolve_local_path(source.url)
            raw_text = extract(str(resolved))
        else:
            raw_text = extract(source.url)
        cache_file.write_text(raw_text, encoding="utf-8")

    return normalize(raw_text)


# ---------------------------------------------------------------------------
# Single-source ingestion
# ---------------------------------------------------------------------------

def ingest_source(
    source: RagSource,
    *,
    max_chars: int = 900,
    overlap_chars: int = 140,
    force_refetch: bool = False,
) -> list[RagChunk]:
    """
    Fetch, extract, normalize, and chunk a single source.

    Returns list[RagChunk] with full provenance.
    Does NOT push to Qdrant – call index_docs.index_chunks() for that.
    """
    if force_refetch:
        cache_file = _cache_path(source)
        if cache_file.exists():
            cache_file.unlink()

    try:
        text = _fetch_raw(source)
    except Exception as exc:
        logger.error("Failed to fetch %s: %s", source.id, exc)
        return []

    if not text.strip():
        logger.warning("Empty text for %s", source.id)
        return []

    doc = RagDocument(
        document_id=source.id,
        source_id=source.id,
        title=source.title,
        url=source.url,
        source_name=source.source_name,
        source_trust_level=source.source_trust_level,
        document_type=source.document_type,
        knowledge_layer=source.knowledge_layer,
        language=source.language,
        jurisdiction=source.jurisdiction,
        topics=source.topics,
        target_groups=source.target_groups,
        publication_date=source.publication_date,
        license_or_rights=source.license_or_rights,
        text=text,
        content_hash=content_hash(text),
        last_checked_at=datetime.now(tz=timezone.utc).isoformat(),
        status=IngestStatus.OK,
    )

    chunks = chunk_document(doc, max_chars=max_chars, overlap_chars=overlap_chars)
    weight = compute_source_weight(source)
    for chunk in chunks:
        chunk.source_weight = weight

    logger.info(
        "Ingested %s: %d chunks (trust=%s, layer=%s)",
        source.id,
        len(chunks),
        source.source_trust_level,
        source.knowledge_layer,
    )
    return chunks


# ---------------------------------------------------------------------------
# Bulk ingestion
# ---------------------------------------------------------------------------

def ingest_all(
    *,
    max_chars: int = 900,
    overlap_chars: int = 140,
    force_refetch: bool = False,
    on_progress: Callable[[str, int], None] | None = None,
) -> dict[str, list[RagChunk]]:
    """
    Ingest all sources from the registry.

    Returns a dict mapping source_id → list[RagChunk].
    """
    sources = load_registry()
    all_chunks: dict[str, list[RagChunk]] = {}

    for i, source in enumerate(sources):
        if on_progress:
            on_progress(source.id, i)
        chunks = ingest_source(
            source,
            max_chars=max_chars,
            overlap_chars=overlap_chars,
            force_refetch=force_refetch,
        )
        all_chunks[source.id] = chunks

    total = sum(len(v) for v in all_chunks.values())
    logger.info("Ingest complete: %d sources, %d chunks total", len(sources), total)
    return all_chunks
