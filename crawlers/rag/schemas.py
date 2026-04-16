"""
Pydantic schemas for the systemfehler RAG pipeline.

Three core types:
  RagSource    – one entry in the source registry
  RagDocument  – one normalized document (before chunking)
  RagChunk     – one indexable unit derived from a RagDocument

Design principles:
  - flat, LLM-ready JSON structures
  - provenance is mandatory on chunks
  - knowledge_layer is used for ranking/filtering (not just display)
  - all fields have sensible defaults so partial data does not crash the pipeline
"""

from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------

class KnowledgeLayer(str, Enum):
    LAW = "law"
    OFFICIAL_GUIDANCE = "official_guidance"
    ADMINISTRATIVE_PRACTICE = "administrative_practice"
    CASE_LAW = "case_law"
    NGO_GUIDANCE = "ngo_guidance"
    UNKNOWN = "unknown"


class SourceTrustLevel(str, Enum):
    TIER_1_LAW = "tier_1_law"
    TIER_2_OFFICIAL = "tier_2_official"
    TIER_3_NGO = "tier_3_ngo"
    TIER_4_OTHER = "tier_4_other"


class DocumentType(str, Enum):
    STATUTE = "statute"
    MERKBLATT = "merkblatt"
    BROSCHUERE = "broschuere"
    FORMULAR = "formular"
    WEISUNG = "weisung"
    FAQ = "faq"
    GUIDE = "guide"
    WEBSITE = "website"
    OTHER = "other"


class IngestStatus(str, Enum):
    PENDING = "pending"
    OK = "ok"
    ERROR = "error"
    SKIPPED = "skipped"
    CACHED = "cached"


# ---------------------------------------------------------------------------
# Source registry entry
# ---------------------------------------------------------------------------

class RagSource(BaseModel):
    """One entry in the source registry (data/_rag_sources/source_registry.json)."""

    id: str
    title: str
    url: str

    source_name: str
    source_type: str = "website"
    source_trust_level: SourceTrustLevel = SourceTrustLevel.TIER_3_NGO
    document_type: DocumentType = DocumentType.OTHER
    knowledge_layer: KnowledgeLayer = KnowledgeLayer.UNKNOWN

    language: str = "de"
    jurisdiction: str = "DE"
    topics: list[str] = Field(default_factory=list)
    target_groups: list[str] = Field(default_factory=list)

    publication_date: Optional[str] = None   # ISO date string, nullable
    license_or_rights: Optional[str] = None
    related_links: list[str] = Field(default_factory=list)
    notes: Optional[str] = None

    # computed at index time
    source_weight: float = 1.0


# ---------------------------------------------------------------------------
# Normalized document (after fetch + extraction)
# ---------------------------------------------------------------------------

class RagDocument(BaseModel):
    """One normalized document ready for chunking."""

    document_id: str                      # stable id derived from source.id
    source_id: str                        # references RagSource.id
    title: str
    url: str

    source_name: str
    source_trust_level: SourceTrustLevel
    document_type: DocumentType
    knowledge_layer: KnowledgeLayer

    language: str = "de"
    jurisdiction: str = "DE"
    topics: list[str] = Field(default_factory=list)
    target_groups: list[str] = Field(default_factory=list)

    publication_date: Optional[str] = None
    last_checked_at: Optional[str] = None  # ISO datetime
    license_or_rights: Optional[str] = None

    file_path: Optional[str] = None        # local cache path if applicable
    content_hash: Optional[str] = None     # sha256 of raw text
    crawler_name: str = "rag_fetcher"
    status: IngestStatus = IngestStatus.PENDING

    text: str = ""                         # extracted, normalized text
    ingest_error: Optional[str] = None


# ---------------------------------------------------------------------------
# Chunk (indexable unit with full provenance)
# ---------------------------------------------------------------------------

class RagChunk(BaseModel):
    """One chunk derived from a RagDocument."""

    chunk_id: str                          # "{document_id}-c{index:04d}"
    document_id: str
    source_id: str

    # Provenance (mandatory – never stripped)
    title: str
    section_title: str = ""               # nearest heading above this chunk
    url: str
    source_name: str
    source_trust_level: SourceTrustLevel
    document_type: DocumentType
    knowledge_layer: KnowledgeLayer
    language: str = "de"
    jurisdiction: str = "DE"
    topics: list[str] = Field(default_factory=list)
    target_groups: list[str] = Field(default_factory=list)
    publication_date: Optional[str] = None
    license_or_rights: Optional[str] = None

    # Content
    text: str
    page_number: Optional[int] = None
    char_start: int = 0
    char_end: int = 0
    chunk_index: int = 0
    total_chunks: int = 1

    # Ranking signal stored in index
    source_weight: float = 1.0


# ---------------------------------------------------------------------------
# Retrieval result (provenance-safe output from the vector layer)
# ---------------------------------------------------------------------------

class RagRetrievalResult(BaseModel):
    """One ranked retrieval result with full provenance."""

    chunk_id: str
    document_id: str
    source_id: str

    title: str
    section_title: str = ""
    url: str
    source_name: str
    source_trust_level: SourceTrustLevel
    document_type: DocumentType
    knowledge_layer: KnowledgeLayer
    language: str = "de"
    jurisdiction: str = "DE"
    topics: list[str] = Field(default_factory=list)
    publication_date: Optional[str] = None

    text: str
    raw_score: float = 0.0
    final_score: float = 0.0
    retrieval_origin: str = "vector"  # "vector" | "keyword" | "hybrid"
