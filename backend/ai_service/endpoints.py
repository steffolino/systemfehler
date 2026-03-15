"""
REST endpoints for query rewrite, answer synthesis, and enrichment suggestion.
"""

from __future__ import annotations

import json
import os
import time

from fastapi import APIRouter

from .cache import (
    CACHE_TTL_RETRIEVE,
    CACHE_TTL_REWRITE,
    CACHE_TTL_SYNTHESIZE,
    ai_cache,
    cache_key,
    fingerprint_evidence,
    normalize_query,
)
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
    "Answer in German, concise and factual. Ignore evidence that is only loosely related "
    "to the user question, especially family-only tools when the question is about unemployment."
)

ENRICH_SYSTEM_PROMPT = (
    "You are assisting editors of a structured public-information database. "
    "Based on the supplied entry excerpt, propose short, concrete metadata improvements in German. "
    "Do not invent facts not grounded in the entry."
)

LOCAL_SYNTHESIS_STRATEGY = os.getenv("AI_LOCAL_SYNTHESIS_STRATEGY", "extractive").strip().lower()
LOCAL_REWRITE_STRATEGY = os.getenv("AI_LOCAL_REWRITE_STRATEGY", "deterministic").strip().lower()


def _usage_totals(payload):
    usage = payload.get("usage", {}) if isinstance(payload, dict) else {}
    total_tokens = int(usage.get("total_tokens", 0) or 0)
    return usage, total_tokens


def _cacheable_response(model):
    if hasattr(model, "model_dump"):
        return model.model_dump()
    return model


def _parse_evidence_payload(content):
    try:
        payload = json.loads(content)
    except Exception:
        return None
    return payload if isinstance(payload, dict) else None


def _best_text(payload, field_name):
    field = payload.get(field_name) if isinstance(payload, dict) else None
    if not isinstance(field, dict):
        return None
    for key in ("de", "easy_de", "en"):
        value = field.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _extractive_answer(evidence):
    cards = []
    sources = []

    for ev in [item for item in evidence if item.confidence >= 0.7][:3]:
        payload = _parse_evidence_payload(ev.content)
        if not payload:
            continue
        title = payload.get("title") or "Unbekannter Eintrag"
        summary = _best_text(payload, "summary")
        domain = payload.get("domain")
        if not isinstance(title, str):
            title = str(title)
        cards.append(
            {
                "title": title,
                "summary": summary,
                "domain": domain if isinstance(domain, str) else None,
            }
        )
        source = payload.get("url") or ev.source
        if isinstance(source, str):
            sources.append(source)

    if not cards:
        return None, []

    lead = cards[0]
    lines = [
        "Wahrscheinlich zuerst relevant:",
        f"- {lead['title']}: {lead['summary'] or 'Direkt pruefen.'}",
    ]

    follow_ups = cards[1:3]
    if follow_ups:
        lines.append("")
        lines.append("Was du jetzt tun kannst:")
        for card in follow_ups:
            if card["domain"] == "tools":
                lines.append(f"- Online starten ueber {card['title']}.")
            elif card["domain"] == "contacts":
                lines.append(f"- Kontakt aufnehmen ueber {card['title']}.")
            else:
                lines.append(f"- Danach {card['title']} pruefen.")

    return "\n".join(lines), sources


def _deterministic_local_rewrite(query):
    normalized = " ".join((query or "").strip().split())
    lowered = normalized.lower()

    if any(term in lowered for term in ("arbeitslos", "job verloren", "job weg", "gekündigt", "gekuendigt")):
        return "arbeitslos jobcenter bürgergeld arbeitsagentur hilfe"
    if any(term in lowered for term in ("buergergeld", "bürgergeld", "jobcenter")):
        return "bürgergeld jobcenter antrag voraussetzungen"
    if any(term in lowered for term in ("kontakt", "telefon", "erreichen", "anrufen")):
        return "arbeitsagentur kontakt telefon beratung"
    if any(term in lowered for term in ("antrag", "beantragen", "formular", "online")):
        return "antrag online arbeitsagentur jobcenter"

    return normalized.lower()


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
    normalized_query = normalize_query(body.query)
    retrieve_cache_key = cache_key("retrieve", normalized_query)
    cached = ai_cache.get(retrieve_cache_key)
    if cached is not None:
        return RetrieveResponse(**cached)

    evidence = retrieve_evidence(body.query)
    sufficient = any(ev.confidence >= 0.7 for ev in evidence)
    latency = int((time.time() - start) * 1000)
    response = RetrieveResponse(
        evidence=evidence,
        weak_evidence=not sufficient,
        latency_ms=latency,
    )
    ai_cache.set(retrieve_cache_key, _cacheable_response(response), CACHE_TTL_RETRIEVE)
    return response


@router.post("/rewrite", response_model=RewriteResponse)
async def rewrite_query(body: QueryRequest):
    start = time.time()
    model = model_router.route("rewrite", explicit_escalation=body.explicit_escalation)
    normalized_query = normalize_query(body.query)
    rewrite_cache_key = cache_key("rewrite", model, normalized_query)
    cached = ai_cache.get(rewrite_cache_key)
    if cached is not None:
        return RewriteResponse(**cached)

    if not provider.is_configured():
        latency = int((time.time() - start) * 1000)
        log_telemetry("rewrite", model, latency, False, 0, 0.0)
        response = RewriteResponse(
            rewritten_query=body.query,
            model=model,
            provider=provider.name,
            latency_ms=latency,
            fallback=True,
            explanation="No AI provider configured; returning the original query.",
        )
        ai_cache.set(rewrite_cache_key, _cacheable_response(response), CACHE_TTL_REWRITE)
        return response

    use_deterministic_local = provider.name == "ollama" and LOCAL_REWRITE_STRATEGY == "deterministic"
    if use_deterministic_local:
        rewritten_query = _deterministic_local_rewrite(body.query)
        latency = int((time.time() - start) * 1000)
        response = RewriteResponse(
            rewritten_query=rewritten_query,
            model=f"{model}:deterministic",
            provider=provider.name,
            latency_ms=latency,
            fallback=False,
            explanation="Local rewrite uses fast deterministic normalization for stable retrieval.",
        )
        ai_cache.set(rewrite_cache_key, _cacheable_response(response), CACHE_TTL_REWRITE)
        log_telemetry("rewrite", model, latency, True, 0, 0.0)
        return response

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
        response = RewriteResponse(
            rewritten_query=rewritten_query,
            model=model,
            provider=provider.name,
            latency_ms=latency,
            fallback=False,
        )
        ai_cache.set(rewrite_cache_key, _cacheable_response(response), CACHE_TTL_REWRITE)
        return response
    except AIProviderError as exc:
        latency = int((time.time() - start) * 1000)
        log_telemetry("rewrite", model, latency, False, 0, 0.0)
        response = RewriteResponse(
            rewritten_query=body.query,
            model=model,
            provider=provider.name,
            latency_ms=latency,
            fallback=True,
            explanation=str(exc),
        )
        ai_cache.set(rewrite_cache_key, _cacheable_response(response), CACHE_TTL_REWRITE)
        return response


@router.post("/synthesize", response_model=AnswerResponse)
async def synthesize_answer(body: QueryRequest):
    start = time.time()
    model = model_router.route("synthesize", explicit_escalation=body.explicit_escalation)
    evidence = retrieve_evidence(body.query)
    sufficient = any(ev.confidence >= 0.7 for ev in evidence)
    normalized_query = normalize_query(body.query)
    evidence_hash = fingerprint_evidence(evidence)
    synth_cache_key = cache_key("synthesize", model, normalized_query, evidence_hash)
    cached = ai_cache.get(synth_cache_key)
    if cached is not None:
        return AnswerResponse(**cached)

    if not sufficient:
        latency = int((time.time() - start) * 1000)
        log_telemetry("synthesize", model, latency, False, 0, 0.0)
        response = AnswerResponse(
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
        ai_cache.set(synth_cache_key, _cacheable_response(response), CACHE_TTL_SYNTHESIZE)
        return response

    use_extractive_local = provider.name == "ollama" and LOCAL_SYNTHESIS_STRATEGY == "extractive"
    if use_extractive_local:
        answer, sources = _extractive_answer(evidence)
        latency = int((time.time() - start) * 1000)
        response = AnswerResponse(
            answer=answer,
            explanation="Antwort basiert direkt auf den relevantesten Einträgen.",
            sources=sources,
            provider=provider.name,
            model=f"{model}:extractive",
            latency_ms=latency,
            fallback=False,
            evidence=evidence,
            weak_evidence=False,
        )
        ai_cache.set(synth_cache_key, _cacheable_response(response), CACHE_TTL_SYNTHESIZE)
        log_telemetry("synthesize", model, latency, True, 0, 0.0)
        return response

    if not provider.is_configured():
        latency = int((time.time() - start) * 1000)
        log_telemetry("synthesize", model, latency, False, 0, 0.0)
        response = AnswerResponse(
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
        ai_cache.set(synth_cache_key, _cacheable_response(response), CACHE_TTL_SYNTHESIZE)
        return response

    evidence_block = _compact_evidence_block(evidence)

    try:
        completion = provider.generate_text(
            model=model,
            system_prompt=SYNTHESIZE_SYSTEM_PROMPT,
            user_prompt=(
                f"User question:\n{body.query}\n\n"
                f"Retrieved evidence:\n{evidence_block}\n\n"
                "Provide a short German answer grounded only in the evidence. "
                "Prefer the most directly relevant unemployment/help entries first. "
                "Use at most 3 bullet points or 3 short sentences."
            ),
            temperature=0.2,
            max_tokens=MAX_SYNTHESIS_TOKENS,
        )
        usage, total_tokens = _usage_totals(completion)
        latency = int((time.time() - start) * 1000)
        log_telemetry("synthesize", model, latency, True, total_tokens, 0.0)
        response = AnswerResponse(
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
        ai_cache.set(synth_cache_key, _cacheable_response(response), CACHE_TTL_SYNTHESIZE)
        return response
    except AIProviderError as exc:
        latency = int((time.time() - start) * 1000)
        log_telemetry("synthesize", model, latency, False, 0, 0.0)
        response = AnswerResponse(
            answer=None,
            explanation=str(exc),
            sources=[ev.source for ev in evidence if ev.confidence >= 0.7],
            provider=provider.name,
            model=model,
            latency_ms=latency,
            fallback=True,
            evidence=evidence,
        )
        ai_cache.set(synth_cache_key, _cacheable_response(response), CACHE_TTL_SYNTHESIZE)
        return response


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
