"""
Strict JSON schemas for outputs
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

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

class EnrichmentSuggestion(BaseModel):
    entry_id: str
    suggestions: List[str]
    provenance: dict


class EnrichmentRequest(BaseModel):
    entry_id: str
    explicit_escalation: bool = False
