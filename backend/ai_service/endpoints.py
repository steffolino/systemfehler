"""
REST endpoints for query rewrite, answer synthesis, enrichment suggestion
"""


from fastapi import APIRouter, Request
from pydantic import BaseModel
from .schemas import Answer, EnrichmentSuggestion
from .retrieval import retrieve_evidence
from .routing import ModelRouter
from .telemetry import log_telemetry, handle_weak_evidence
import time

router = APIRouter()
model_router = ModelRouter()

class QueryRequest(BaseModel):
    query: str

@router.post("/rewrite")
async def rewrite_query(query: str, request: Request):
    start = time.time()
    model = model_router.route("rewrite")
    # Stub: LLM call
    rewritten_query = query.upper()  # Replace with real LLM call
    latency = int((time.time() - start) * 1000)
    log_telemetry("rewrite", model, latency, True, 10, 0.001)
    return {"rewritten_query": rewritten_query, "model": model, "latency_ms": latency}

@router.post("/synthesize")
async def synthesize_answer(body: QueryRequest):
    start = time.time()
    model = model_router.route("synthesize")
    evidence = retrieve_evidence(body.query)
    # Enforce minimum evidence threshold
    min_confidence = 0.7
    sufficient = any(ev.confidence >= min_confidence for ev in evidence)
    if not sufficient:
        latency = int((time.time() - start) * 1000)
        log_telemetry("synthesize", model, latency, False, 10, 0.001)
        return {
            "answer": None,
            "explanation": "Keine verlässliche Information gefunden.",
            "sources": [],
            "fallback": True,
            "model": model,
            "latency_ms": latency
        }
    # Stub: LLM call for synthesis
    answer = f"Synthesized answer for: {body.query}"
    sources = [ev.source for ev in evidence if ev.confidence >= min_confidence]
    latency = int((time.time() - start) * 1000)
    log_telemetry("synthesize", model, latency, True, 20, 0.002)
    return {
        "answer": answer,
        "explanation": "Antwort basiert auf verlässlichen Daten.",
        "sources": sources,
        "fallback": False,
        "model": model,
        "latency_ms": latency
    }

@router.post("/enrich")
async def suggest_enrichment(entry_id: str, request: Request):
    start = time.time()
    model = model_router.route("enrich")
    # Stub: LLM call for enrichment suggestion
    suggestions = [f"Enrichment suggestion for entry {entry_id}"]
    latency = int((time.time() - start) * 1000)
    log_telemetry("enrich", model, latency, True, 15, 0.0015)
    # Do NOT write directly to production data; moderation required
    return EnrichmentSuggestion(entry_id=entry_id, suggestions=suggestions, provenance={"model": model, "latency_ms": latency})
