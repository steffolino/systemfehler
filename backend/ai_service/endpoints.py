"""
REST endpoints for query rewrite, answer synthesis, and enrichment suggestion.
"""

from __future__ import annotations

import json
import time

from fastapi import APIRouter

from .provider import AIProviderError, get_provider
from .retrieval import retrieve_evidence
from .routing import ModelRouter
from .schemas import (
    AnswerResponse,
    EnrichmentRequest,
    EnrichmentSuggestion,
    QueryRequest,
    RetrieveResponse,
    RewriteResponse,
)
from .telemetry import log_telemetry

router = APIRouter()
model_router = ModelRouter()
provider = get_provider()
MAX_REWRITE_TOKENS = 24
MAX_SYNTHESIS_TOKENS = 160
MAX_ENRICH_TOKENS = 96

REWRITE_SYSTEM_PROMPT = (
    "You rewrite search queries for a German social-services retrieval system. "
    "Return a short German search query that improves recall but does not add new facts."
)

SYNTHESIZE_SYSTEM_PROMPT = (
    "You are a retrieval-first assistant for German social-service information. "
    "Use only the provided evidence. If the evidence is weak, say so and do not guess. "
    "Answer in German, concise and factual."
)

ENRICH_SYSTEM_PROMPT = (
    "You are assisting editors of a structured public-information database. "
    "Based on the supplied entry excerpt, propose short, concrete metadata improvements in German. "
    "Do not invent facts not grounded in the entry."
)


def _usage_totals(payload):
    usage = payload.get("usage", {}) if isinstance(payload, dict) else {}
    total_tokens = int(usage.get("total_tokens", 0) or 0)
    return usage, total_tokens


def _compact_evidence_block(evidence):
    compact_rows = []
    for index, ev in enumerate([item for item in evidence if item.confidence >= 0.7][:3], start=1):
        try:
            payload = json.loads(ev.content)
        except Exception:
            payload = {}
        if not isinstance(payload, dict):
            payload = {}
        summary = payload.get("summary", {}) if isinstance(payload.get("summary"), dict) else {}
        content = payload.get("content", {}) if isinstance(payload.get("content"), dict) else {}
        compact_rows.append(
            "\n".join(
                [
                    f"Evidence {index}",
                    f"Title: {payload.get('title') or 'Unbekannt'}",
                    f"Domain: {payload.get('domain') or 'unknown'}",
                    f"URL: {payload.get('url') or 'unknown'}",
                    f"Summary: {summary.get('de') or summary.get('en') or 'Keine Kurzbeschreibung'}",
                    f"Content excerpt: {(content.get('de') or content.get('en') or '')[:220]}",
                    f"Topics: {', '.join(payload.get('topics') or [])}",
                ]
            )
        )
    return "\n\n".join(compact_rows)


@router.post("/retrieve", response_model=RetrieveResponse)
async def retrieve_only(body: QueryRequest):
    start = time.time()
    evidence = retrieve_evidence(body.query)
    sufficient = any(ev.confidence >= 0.7 for ev in evidence)
    latency = int((time.time() - start) * 1000)
    return RetrieveResponse(
        evidence=evidence,
        weak_evidence=not sufficient,
        latency_ms=latency,
    )


@router.post("/rewrite", response_model=RewriteResponse)
async def rewrite_query(body: QueryRequest):
    start = time.time()
    model = model_router.route("rewrite", explicit_escalation=body.explicit_escalation)

    if not provider.is_configured():
        latency = int((time.time() - start) * 1000)
        log_telemetry("rewrite", model, latency, False, 0, 0.0)
        return RewriteResponse(
            rewritten_query=body.query,
            model=model,
            provider=provider.name,
            latency_ms=latency,
            fallback=True,
            explanation="No AI provider configured; returning the original query.",
        )

    try:
        completion = provider.generate_text(
            model=model,
            system_prompt=REWRITE_SYSTEM_PROMPT,
            user_prompt=(
                "Original query:\n"
                f"{body.query}\n\n"
                "Return only the rewritten query."
            ),
            temperature=0.1,
            max_tokens=MAX_REWRITE_TOKENS,
        )
        usage, total_tokens = _usage_totals(completion)
        rewritten_query = completion["text"].strip()
        latency = int((time.time() - start) * 1000)
        log_telemetry("rewrite", model, latency, True, total_tokens, 0.0)
        return RewriteResponse(
            rewritten_query=rewritten_query,
            model=model,
            provider=provider.name,
            latency_ms=latency,
            fallback=False,
        )
    except AIProviderError as exc:
        latency = int((time.time() - start) * 1000)
        log_telemetry("rewrite", model, latency, False, 0, 0.0)
        return RewriteResponse(
            rewritten_query=body.query,
            model=model,
            provider=provider.name,
            latency_ms=latency,
            fallback=True,
            explanation=str(exc),
        )


@router.post("/synthesize", response_model=AnswerResponse)
async def synthesize_answer(body: QueryRequest):
    start = time.time()
    model = model_router.route("synthesize", explicit_escalation=body.explicit_escalation)
    evidence = retrieve_evidence(body.query)
    sufficient = any(ev.confidence >= 0.7 for ev in evidence)

    if not sufficient:
        latency = int((time.time() - start) * 1000)
        log_telemetry("synthesize", model, latency, False, 0, 0.0)
        return AnswerResponse(
            answer=None,
            explanation="Keine verlässliche Information gefunden.",
            sources=[],
            provider=provider.name,
            model=model,
            latency_ms=latency,
            fallback=True,
            evidence=evidence,
            weak_evidence=True,
        )

    if not provider.is_configured():
        latency = int((time.time() - start) * 1000)
        log_telemetry("synthesize", model, latency, False, 0, 0.0)
        return AnswerResponse(
            answer=None,
            explanation="AI provider not configured. Evidence retrieval worked, but no synthesis backend is available.",
            sources=[ev.source for ev in evidence if ev.confidence >= 0.7],
            provider=provider.name,
            model=model,
            latency_ms=latency,
            fallback=True,
            evidence=evidence,
            weak_evidence=False,
        )

    evidence_block = _compact_evidence_block(evidence)

    try:
        completion = provider.generate_text(
            model=model,
            system_prompt=SYNTHESIZE_SYSTEM_PROMPT,
            user_prompt=(
                f"User question:\n{body.query}\n\n"
                f"Retrieved evidence:\n{evidence_block}\n\n"
                "Provide a short German answer grounded only in the evidence. "
                "Use at most 4 bullet points or 4 short sentences."
            ),
            temperature=0.2,
            max_tokens=MAX_SYNTHESIS_TOKENS,
        )
        usage, total_tokens = _usage_totals(completion)
        latency = int((time.time() - start) * 1000)
        log_telemetry("synthesize", model, latency, True, total_tokens, 0.0)
        return AnswerResponse(
            answer=completion["text"],
            explanation="Antwort basiert auf abgerufenen Einträgen.",
            sources=[ev.source for ev in evidence if ev.confidence >= 0.7],
            provider=provider.name,
            model=model,
            latency_ms=latency,
            fallback=False,
            evidence=evidence,
            usage=usage,
        )
    except AIProviderError as exc:
        latency = int((time.time() - start) * 1000)
        log_telemetry("synthesize", model, latency, False, 0, 0.0)
        return AnswerResponse(
            answer=None,
            explanation=str(exc),
            sources=[ev.source for ev in evidence if ev.confidence >= 0.7],
            provider=provider.name,
            model=model,
            latency_ms=latency,
            fallback=True,
            evidence=evidence,
        )


@router.post("/enrich", response_model=EnrichmentSuggestion)
async def suggest_enrichment(body: EnrichmentRequest):
    start = time.time()
    model = model_router.route("enrich", explicit_escalation=body.explicit_escalation)

    if not provider.is_configured():
        latency = int((time.time() - start) * 1000)
        log_telemetry("enrich", model, latency, False, 0, 0.0)
        return EnrichmentSuggestion(
            entry_id=body.entry_id,
            suggestions=[],
            provenance={
                "provider": provider.name,
                "model": model,
                "latency_ms": latency,
                "fallback": True,
                "message": "No AI provider configured.",
            },
        )

    try:
        completion = provider.generate_text(
            model=model,
            system_prompt=ENRICH_SYSTEM_PROMPT,
            user_prompt=(
                f"Entry ID: {body.entry_id}\n\n"
                "Suggest up to 5 short metadata or quality improvements as separate bullet points."
            ),
            temperature=0.2,
            max_tokens=MAX_ENRICH_TOKENS,
        )
        usage, total_tokens = _usage_totals(completion)
        suggestions = [
            line.lstrip("- ").strip()
            for line in completion["text"].splitlines()
            if line.strip()
        ][:5]
        latency = int((time.time() - start) * 1000)
        log_telemetry("enrich", model, latency, True, total_tokens, 0.0)
        return EnrichmentSuggestion(
            entry_id=body.entry_id,
            suggestions=suggestions,
            provenance={
                "provider": provider.name,
                "model": model,
                "latency_ms": latency,
                "usage": usage,
            },
        )
    except AIProviderError as exc:
        latency = int((time.time() - start) * 1000)
        log_telemetry("enrich", model, latency, False, 0, 0.0)
        return EnrichmentSuggestion(
            entry_id=body.entry_id,
            suggestions=[],
            provenance={
                "provider": provider.name,
                "model": model,
                "latency_ms": latency,
                "fallback": True,
                "message": str(exc),
            },
        )
