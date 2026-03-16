"""
REST endpoints for query rewrite, answer synthesis, and enrichment suggestion.
"""

from __future__ import annotations

import json
import os
import re
import time
from pathlib import Path

from fastapi import APIRouter

from .cache import (
    CACHE_TTL_ENRICH,
    CACHE_TTL_RETRIEVE,
    CACHE_TTL_REWRITE,
    CACHE_TTL_SYNTHESIZE,
    ai_cache,
    cache_key,
    fingerprint_evidence,
    fingerprint_payload,
    normalize_query,
)
from .provider import AIProviderError, get_provider
from .retrieval import retrieve_evidence
from .routing import ModelRouter
from .schemas import (
    AnswerResponse,
    EnrichmentFacet,
    EnrichmentPayload,
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
REPO_ROOT = Path(__file__).resolve().parents[2]


def _load_taxonomy_ids(filename, key):
    path = REPO_ROOT / "data" / "_taxonomy" / filename
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return set()
    values = payload.get(key, []) if isinstance(payload, dict) else []
    return {
        item.get("id")
        for item in values
        if isinstance(item, dict) and isinstance(item.get("id"), str)
    }


def _load_topic_profiles():
    path = REPO_ROOT / "data" / "_topics" / "trusted_topic_sources.json"
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return []
    return payload.get("topics", []) if isinstance(payload, dict) else []


KNOWN_TOPICS = _load_taxonomy_ids("topics.json", "topics")
KNOWN_TAGS = _load_taxonomy_ids("tags.json", "tags")
KNOWN_TARGET_GROUPS = _load_taxonomy_ids("target_groups.json", "targetGroups")
TOPIC_PROFILES = _load_topic_profiles()
STOPWORDS = {
    "aber",
    "alle",
    "als",
    "auch",
    "bei",
    "damit",
    "dann",
    "dass",
    "de",
    "den",
    "der",
    "des",
    "die",
    "ein",
    "eine",
    "einer",
    "einen",
    "eines",
    "er",
    "es",
    "fuer",
    "fur",
    "hat",
    "hilfe",
    "ich",
    "ihnen",
    "ist",
    "mit",
    "nach",
    "nicht",
    "oder",
    "sie",
    "sich",
    "sind",
    "und",
    "von",
    "wenn",
    "wie",
    "wir",
}
METADATA_RULES = [
    {
        "patterns": ("arbeitslos", "arbeitsagentur", "jobcenter", "arbeitslosengeld", "buergergeld", "burgergeld"),
        "topics": {"employment", "financial_support"},
        "target_groups": {"unemployed"},
        "keywords": {"arbeitslos", "jobcenter", "buergergeld", "arbeitsagentur"},
        "rationale": "Employment and income-support terms are dominant in the entry.",
    },
    {
        "patterns": ("elterngeld", "familie", "familien", "kinder", "alleinerzieh"),
        "topics": {"family", "financial_support"},
        "target_groups": {"families", "single_parents"},
        "keywords": {"elterngeld", "familie", "kinder"},
        "rationale": "Family-related support language appears in the entry.",
    },
    {
        "patterns": ("wohnung", "wohngeld", "miete", "miet", "unterkunft"),
        "topics": {"housing", "financial_support"},
        "keywords": {"wohngeld", "miete", "wohnung"},
        "rationale": "Housing support terms are present.",
    },
    {
        "patterns": ("gesund", "pflege", "krank", "reha"),
        "topics": {"healthcare"},
        "keywords": {"gesundheit", "pflege"},
        "rationale": "Health-related support language appears in the entry.",
    },
    {
        "patterns": ("bildung", "ausbildung", "schule", "stud", "weiterbildung"),
        "topics": {"education"},
        "target_groups": {"students"},
        "keywords": {"bildung", "ausbildung", "studium"},
        "rationale": "Education-related terms are present.",
    },
    {
        "patterns": ("gefluecht", "geflucht", "asyl", "ukraine"),
        "target_groups": {"refugees"},
        "keywords": {"gefluechtete", "asyl"},
        "rationale": "Refugee-related language is present.",
    },
    {
        "patterns": ("behinder", "barriere", "inklusion"),
        "target_groups": {"disabled"},
        "keywords": {"behinderung", "barrierefrei"},
        "rationale": "Disability or accessibility language is present.",
    },
]


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
    matched_topics = _match_topic_profiles(normalized)

    if matched_topics:
        top_topic = matched_topics[0]
        curated_keywords = []
        for keyword in top_topic.get("keywords", []):
            if not isinstance(keyword, str):
                continue
            normalized_keyword = _normalize_keyword(keyword)
            if normalized_keyword in STOPWORDS or normalized_keyword in curated_keywords:
                continue
            curated_keywords.append(normalized_keyword)
        if curated_keywords:
            return " ".join(curated_keywords[:6])

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


def _clean_list(values):
    cleaned = []
    seen = set()
    for value in values or []:
        if not isinstance(value, str):
            continue
        normalized = value.strip()
        if not normalized:
            continue
        key = normalized.lower()
        if key in seen:
            continue
        seen.add(key)
        cleaned.append(normalized)
    return cleaned


def _normalize_keyword(value):
    return (
        value.lower()
        .replace("ä", "ae")
        .replace("ö", "oe")
        .replace("ü", "ue")
        .replace("ß", "ss")
        .replace("Ã¤", "ae")
        .replace("Ã¶", "oe")
        .replace("Ã¼", "ue")
        .replace("ÃŸ", "ss")
    )


def _match_topic_profiles(text):
    normalized = _normalize_keyword(text or "")
    tokens = set(re.findall(r"[a-z0-9_-]{3,}", normalized))
    matches = []

    for topic in TOPIC_PROFILES:
        if not isinstance(topic, dict):
            continue
        keywords = [
            _normalize_keyword(keyword)
            for keyword in topic.get("keywords", [])
            if isinstance(keyword, str)
        ]
        hits = sum(1 for keyword in keywords if keyword in normalized or keyword in tokens)
        if hits > 0:
            matches.append((hits, topic))

    matches.sort(key=lambda item: (-item[0], str(item[1].get("id") or "")))
    return [topic for _, topic in matches]


def _topic_refs(topics, limit=3):
    refs = []
    for topic in topics[:limit]:
        if not isinstance(topic, dict):
            continue
        label = str(topic.get("name") or topic.get("id") or "").strip()
        topic_id = str(topic.get("id") or "").strip()
        if not label and not topic_id:
            continue
        refs.append(
            {
                "id": topic_id,
                "name": label or topic_id,
            }
        )
    return refs


def _entry_text_blob(entry):
    parts = []
    title = entry.get("title")
    if isinstance(title, str):
        parts.append(title)
    elif isinstance(title, dict):
        parts.extend(str(value) for value in title.values() if isinstance(value, str))
    for key in (
        "title_de",
        "title_en",
        "summary_de",
        "summary_en",
        "content_de",
        "content_en",
        "url",
        "domain",
    ):
        value = entry.get(key)
        if isinstance(value, str):
            parts.append(value)
    for field in ("summary", "content"):
        value = entry.get(field)
        if isinstance(value, dict):
            parts.extend(str(item) for item in value.values() if isinstance(item, str))
    return " ".join(parts).lower()


def _score_confidence(current, added, base):
    if not added:
        return 0.35 if current else 0.0
    return min(0.95, base + (0.08 * len(added)))


def _keyword_key(value):
    return (
        value.lower()
        .replace("ä", "ae")
        .replace("ö", "oe")
        .replace("ü", "ue")
        .replace("ß", "ss")
    )


def _build_facet(current, suggested, rationale, base_confidence):
    current_list = _clean_list(current)
    suggested_list = _clean_list(suggested)
    current_keys = {value.lower() for value in current_list}
    suggested_keys = {value.lower() for value in suggested_list}
    added = [value for value in suggested_list if value.lower() not in current_keys]
    removed = [value for value in current_list if value.lower() not in suggested_keys]
    return EnrichmentFacet(
        current=current_list,
        suggested=suggested_list,
        added=added,
        removed=removed,
        confidence=_score_confidence(current_list, added, base_confidence),
        rationale=rationale,
    )


def _infer_keywords(entry, text_blob):
    keywords = {}
    for rule in METADATA_RULES:
        if any(pattern in text_blob for pattern in rule["patterns"]):
            for value in rule.get("keywords", set()):
                keywords.setdefault(_keyword_key(value), value)

    title = entry.get("title")
    title_text = title if isinstance(title, str) else entry.get("title_de")
    if isinstance(title_text, str):
        for token in title_text.lower().replace("-", " ").split():
            token = "".join(char for char in token if char.isalpha())
            if len(token) < 4 or token in STOPWORDS:
                continue
            keywords.setdefault(_keyword_key(token), token)

    return sorted(keywords.values())[:8]


def _derive_metadata_suggestions(entry):
    current_topics = _clean_list(entry.get("topics") or [])
    current_tags = _clean_list(entry.get("tags") or [])
    current_target_groups = _clean_list(entry.get("targetGroups") or entry.get("target_groups") or [])
    text_blob = _entry_text_blob(entry)
    matched_topics = _match_topic_profiles(text_blob)

    suggested_topics = set(current_topics)
    suggested_tags = set(current_tags)
    suggested_target_groups = set(current_target_groups)
    rationales = []

    for rule in METADATA_RULES:
        if any(pattern in text_blob for pattern in rule["patterns"]):
            suggested_topics.update(rule.get("topics", set()))
            suggested_target_groups.update(rule.get("target_groups", set()))
            rationale = rule.get("rationale")
            if isinstance(rationale, str):
                rationales.append(rationale)

    for topic in matched_topics[:2]:
        topic_id = topic.get("id")
        topic_name = topic.get("name")
        if isinstance(topic_id, str) and topic_id in KNOWN_TOPICS:
            suggested_topics.add(topic_id)
        if isinstance(topic_name, str):
            rationales.append(f"Trusted topic profile matched: {topic_name}.")

    if any(pattern in text_blob for pattern in ("antrag", "beantrag", "formular", "online beantragen", "jobcenter")):
        suggested_tags.add("application_required")
        rationales.append("Application language suggests an explicit application step.")
    if any(pattern in text_blob for pattern in ("einkommen", "lebensunterhalt", "anspruch", "hilfebeduerf", "hilfebedurf")):
        suggested_tags.add("means_tested")
        rationales.append("Eligibility appears tied to income or need.")
    if any(pattern in text_blob for pattern in ("frist", "deadline", "spaetestens", "spätestens", "bis zum")):
        suggested_tags.add("time_limited")
        rationales.append("A deadline or time limit is mentioned.")
    if any(pattern in text_blob for pattern in ("sofort", "notfall", "akut", "dringend")):
        suggested_tags.add("urgent")
        rationales.append("The text suggests urgency or emergency context.")
    if any(pattern in text_blob for pattern in ("automatisch", "ohne antrag", "automatische")):
        suggested_tags.add("automatic")
        rationales.append("The text suggests an automatic process.")

    suggested_topics = sorted(topic for topic in suggested_topics if topic in KNOWN_TOPICS)
    suggested_tags = sorted(tag for tag in suggested_tags if tag in KNOWN_TAGS)
    suggested_target_groups = sorted(group for group in suggested_target_groups if group in KNOWN_TARGET_GROUPS)
    suggested_keywords = _infer_keywords(entry, text_blob)
    existing_keyword_keys = {_keyword_key(item) for item in suggested_keywords}
    for topic in matched_topics[:2]:
        for keyword in topic.get("keywords", []):
            if not isinstance(keyword, str):
                continue
            normalized_keyword = _normalize_keyword(keyword)
            if len(normalized_keyword) < 4 or normalized_keyword in existing_keyword_keys:
                continue
            suggested_keywords.append(normalized_keyword)
            existing_keyword_keys.add(normalized_keyword)
    suggested_keywords = suggested_keywords[:8]

    summary_value = entry.get("summary")
    content_value = entry.get("content")
    summary_de = summary_value.get("de") if isinstance(summary_value, dict) else None
    content_de = content_value.get("de") if isinstance(content_value, dict) else None

    quality_flags = []
    if not current_topics and suggested_topics:
        quality_flags.append("missing_topics")
    if not current_tags and suggested_tags:
        quality_flags.append("missing_tags")
    if not current_target_groups and suggested_target_groups:
        quality_flags.append("missing_target_groups")
    if not isinstance(entry.get("summary_de"), str) and not isinstance(summary_de, str):
        quality_flags.append("missing_german_summary")
    if not isinstance(entry.get("content_de"), str) and not isinstance(content_de, str):
        quality_flags.append("missing_german_content")

    summary = []
    if suggested_topics:
        summary.append(f"Suggested {len(suggested_topics)} topic labels for stronger thematic recall.")
    if suggested_target_groups:
        summary.append(f"Suggested {len(suggested_target_groups)} target groups for audience-aware search.")
    if suggested_keywords:
        summary.append("Suggested keywords can improve AI retrieval prompts and future autocomplete.")
    if matched_topics:
        summary.append(
            "Matched trusted topic profiles: "
            + ", ".join(str(topic.get("name") or topic.get("id")) for topic in matched_topics[:2])
            + "."
        )

    rationale = " ".join(dict.fromkeys(rationales)) or "Suggestions are derived from deterministic taxonomy matching."
    metadata = EnrichmentPayload(
        topics=_build_facet(current_topics, suggested_topics, rationale, 0.62),
        tags=_build_facet(current_tags, suggested_tags, rationale, 0.58),
        target_groups=_build_facet(current_target_groups, suggested_target_groups, rationale, 0.64),
        keywords=_build_facet([], suggested_keywords, "Keywords are extracted from title and content signals.", 0.55),
    )
    matched_topic_refs = _topic_refs(matched_topics)

    return metadata, summary, quality_flags, matched_topic_refs


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
            matched_topics=[item["name"] for item in _topic_refs(_match_topic_profiles(body.query))],
        )
        ai_cache.set(rewrite_cache_key, _cacheable_response(response), CACHE_TTL_REWRITE)
        return response

    use_deterministic_local = provider.name == "ollama" and LOCAL_REWRITE_STRATEGY == "deterministic"
    if use_deterministic_local:
        matched_topics = [item["name"] for item in _topic_refs(_match_topic_profiles(body.query))]
        rewritten_query = _deterministic_local_rewrite(body.query)
        latency = int((time.time() - start) * 1000)
        response = RewriteResponse(
            rewritten_query=rewritten_query,
            model=f"{model}:deterministic",
            provider=provider.name,
            latency_ms=latency,
            fallback=False,
            explanation=(
                "Local rewrite uses fast deterministic normalization for stable retrieval."
                + (f" Matched topic profiles: {', '.join(matched_topics)}." if matched_topics else "")
            ),
            matched_topics=matched_topics,
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
            matched_topics=[item["name"] for item in _topic_refs(_match_topic_profiles(body.query))],
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
            matched_topics=[item["name"] for item in _topic_refs(_match_topic_profiles(body.query))],
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
    entry_payload = body.entry if isinstance(body.entry, dict) else {}
    entry_fingerprint = fingerprint_payload(
        {
            "entry_id": body.entry_id,
            "entry": entry_payload,
        }
    )
    enrich_cache_key = cache_key("enrich", model, body.entry_id, entry_fingerprint)
    cached = ai_cache.get(enrich_cache_key)
    if cached is not None:
        return EnrichmentSuggestion(**cached)

    metadata, summary, quality_flags, matched_topics = _derive_metadata_suggestions(entry_payload)
    deterministic_response = EnrichmentSuggestion(
        entry_id=body.entry_id,
        summary=summary,
        quality_flags=quality_flags,
        metadata=metadata,
        provenance={
            "provider": provider.name,
            "model": f"{model}:deterministic",
            "strategy": "taxonomy_heuristics",
            "matched_topics": matched_topics,
        },
    )

    if not provider.is_configured():
        latency = int((time.time() - start) * 1000)
        log_telemetry("enrich", model, latency, False, 0, 0.0)
        response = deterministic_response.model_copy(
            update={
                "provenance": {
                    **deterministic_response.provenance,
                    "latency_ms": latency,
                    "fallback": True,
                    "message": "No AI provider configured.",
                }
            }
        )
        ai_cache.set(enrich_cache_key, _cacheable_response(response), CACHE_TTL_ENRICH)
        return response

    # Keep local enrichment deterministic-first for speed and reviewability.
    if provider.name == "ollama":
        latency = int((time.time() - start) * 1000)
        response = deterministic_response.model_copy(
            update={
                "provenance": {
                    **deterministic_response.provenance,
                    "provider": provider.name,
                    "latency_ms": latency,
                    "fallback": False,
                }
            }
        )
        ai_cache.set(enrich_cache_key, _cacheable_response(response), CACHE_TTL_ENRICH)
        log_telemetry("enrich", model, latency, True, 0, 0.0)
        return response

    try:
        completion = provider.generate_text(
            model=model,
            system_prompt=ENRICH_SYSTEM_PROMPT,
            user_prompt=(
                f"Entry ID: {body.entry_id}\n\n"
                f"Entry excerpt:\n{json.dumps(entry_payload, ensure_ascii=False)[:2400]}\n\n"
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
        response = deterministic_response.model_copy(
            update={
                "summary": deterministic_response.summary + suggestions,
                "provenance": {
                    **deterministic_response.provenance,
                    "provider": provider.name,
                    "model": model,
                    "latency_ms": latency,
                    "usage": usage,
                    "fallback": False,
                    "llm_notes": suggestions,
                },
            }
        )
        ai_cache.set(enrich_cache_key, _cacheable_response(response), CACHE_TTL_ENRICH)
        return response
    except AIProviderError as exc:
        latency = int((time.time() - start) * 1000)
        log_telemetry("enrich", model, latency, False, 0, 0.0)
        response = deterministic_response.model_copy(
            update={
                "provenance": {
                    **deterministic_response.provenance,
                    "provider": provider.name,
                    "model": model,
                    "latency_ms": latency,
                    "fallback": True,
                    "message": str(exc),
                }
            }
        )
        ai_cache.set(enrich_cache_key, _cacheable_response(response), CACHE_TTL_ENRICH)
        return response
