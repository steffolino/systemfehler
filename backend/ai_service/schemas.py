"""
Strict JSON schemas for outputs
"""
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

class Evidence(BaseModel):
    source: str
    content: str
    confidence: float

class QueryRequest(BaseModel):
    query: str
    explicit_escalation: bool = False


class RewriteResponse(BaseModel):
    rewritten_query: str
    model: str
    provider: str
    latency_ms: int
    fallback: bool = False
    explanation: Optional[str] = None


class RetrieveResponse(BaseModel):
    evidence: List[Evidence] = Field(default_factory=list)
    weak_evidence: bool = False
    latency_ms: int


class AnswerResponse(BaseModel):
    answer: Optional[str]
    explanation: str
    sources: List[str]
    provider: str
    model: str
    latency_ms: int
    fallback: bool = False
    evidence: List[Evidence] = Field(default_factory=list)
    weak_evidence: Optional[bool] = False
    usage: Dict[str, Any] = Field(default_factory=dict)


class EnrichmentFacet(BaseModel):
    current: List[str] = Field(default_factory=list)
    suggested: List[str] = Field(default_factory=list)
    added: List[str] = Field(default_factory=list)
    removed: List[str] = Field(default_factory=list)
    confidence: float = 0.0
    rationale: str = ""


class EnrichmentPayload(BaseModel):
    topics: EnrichmentFacet = Field(default_factory=EnrichmentFacet)
    tags: EnrichmentFacet = Field(default_factory=EnrichmentFacet)
    target_groups: EnrichmentFacet = Field(default_factory=EnrichmentFacet)
    keywords: EnrichmentFacet = Field(default_factory=EnrichmentFacet)


class EnrichmentSuggestion(BaseModel):
    entry_id: str
    summary: List[str] = Field(default_factory=list)
    quality_flags: List[str] = Field(default_factory=list)
    metadata: EnrichmentPayload = Field(default_factory=EnrichmentPayload)
    provenance: Dict[str, Any] = Field(default_factory=dict)


class EnrichmentRequest(BaseModel):
    entry_id: str
    entry: Dict[str, Any] = Field(default_factory=dict)
    explicit_escalation: bool = False
