"""
Strict JSON schemas for outputs
"""
from pydantic import BaseModel, Field
from typing import List, Optional

class Evidence(BaseModel):
    source: str
    content: str
    confidence: float

class Answer(BaseModel):
    query: str
    evidence: List[Evidence]
    answer: str
    provenance: dict
    weak_evidence: Optional[bool] = False

class EnrichmentSuggestion(BaseModel):
    entry_id: str
    suggestions: List[str]
    provenance: dict
