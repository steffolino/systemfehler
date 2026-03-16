"""
Retrieval-first answer pipeline
- Structured data is source of truth
- LLM only for synthesis
"""

from .schemas import Evidence
import json
import os
import jsonschema
import re
from urllib.parse import urlparse


# ORM database access layer
from .db import SessionLocal, Entry
from sqlalchemy import text

import datetime

STOPWORDS = {
    "ich", "habe", "hab", "mein", "meinen", "meine", "meiner", "was", "nun",
    "und", "oder", "der", "die", "das", "ein", "eine", "einer", "einem",
    "für", "fuer", "mit", "von", "auf", "zu", "zum", "zur", "den", "dem",
    "im", "in", "am", "an", "wie", "kann", "kannst", "können", "koennen",
    "tun", "jetzt", "kurz", "hilfe", "bekomme", "bekommt", "bekommen",
}

SYNONYM_EXPANSIONS = {
    "job": ["arbeitslosigkeit", "arbeitslos", "arbeitsagentur"],
    "arbeitsplatz": ["arbeitslosigkeit", "arbeitslos", "arbeitsagentur"],
    "verloren": ["arbeitslosigkeit", "arbeitslosengeld", "buergergeld"],
    "bürgergeld": ["buergergeld", "jobcenter", "grundsicherung"],
    "buergergeld": ["bürgergeld", "jobcenter", "grundsicherung"],
    "arbeitslos": ["arbeitslosigkeit", "arbeitslosengeld", "buergergeld"],
    "arbeitslosigkeit": ["arbeitslosengeld", "buergergeld", "jobcenter"],
}

INTENT_KEYWORDS = {
    "unemployment": {
        "arbeitslos", "arbeitslosigkeit", "job", "arbeitsplatz", "jobcenter",
        "buergergeld", "bürgergeld", "arbeitsagentur", "arbeitslosengeld",
        "kuendigung", "kündigung",
    },
    "family": {
        "familie", "familien", "kind", "kinder", "eltern", "elterngeld",
        "schwanger", "schwangerschaft",
    },
    "contact": {
        "kontakt", "telefon", "anrufen", "sprechstunde", "erreichen",
        "beratung", "hotline",
    },
    "application": {
        "antrag", "beantragen", "anmelden", "formular", "online", "weiterbewilligung",
    },
}

NEGATIVE_HINTS = {
    "unemployment": {
        "kurzarbeitergeld": 4.5,
        "kurzarbeit": 4.5,
    },
}

_TOPIC_REGISTRY_CACHE = None
_REGISTERED_SOURCE_HOSTS_CACHE = None


def _data_dir():
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "../../data"))


def _load_registered_source_hosts():
    global _REGISTERED_SOURCE_HOSTS_CACHE
    if _REGISTERED_SOURCE_HOSTS_CACHE is not None:
        return _REGISTERED_SOURCE_HOSTS_CACHE

    path = os.path.join(_data_dir(), "_sources", "registered_sources.json")
    hosts = {}
    try:
        with open(path, "r", encoding="utf-8") as handle:
            payload = json.load(handle)
        for source in payload.get("sources", []):
            if not isinstance(source, dict):
                continue
            source_id = str(source.get("id") or "").strip()
            base_url = str(source.get("baseUrl") or "").strip()
            if not source_id or not base_url:
                continue
            host = (urlparse(base_url).netloc or "").lower()
            host = host[4:] if host.startswith("www.") else host
            if host:
                hosts[source_id] = host
    except Exception:
        hosts = {}

    _REGISTERED_SOURCE_HOSTS_CACHE = hosts
    return hosts


def _load_topic_registry():
    global _TOPIC_REGISTRY_CACHE
    if _TOPIC_REGISTRY_CACHE is not None:
        return _TOPIC_REGISTRY_CACHE

    path = os.path.join(_data_dir(), "_topics", "trusted_topic_sources.json")
    topics = []
    try:
        with open(path, "r", encoding="utf-8") as handle:
            payload = json.load(handle)
        topics = payload.get("topics", []) if isinstance(payload, dict) else []
    except Exception:
        topics = []

    _TOPIC_REGISTRY_CACHE = topics
    return topics


def _extract_host(value: str | None):
    if not isinstance(value, str) or not value.strip():
        return ""
    host = (urlparse(value).netloc or "").lower()
    host = host[4:] if host.startswith("www.") else host
    return host


def _detect_topic_profiles(query: str, terms: list[str]):
    normalized = (query or "").lower()
    token_set = set(terms)
    matched = []
    for topic in _load_topic_registry():
        if not isinstance(topic, dict):
            continue
        keywords = {
            str(keyword).lower()
            for keyword in topic.get("keywords", [])
            if isinstance(keyword, str)
        }
        if not keywords:
            continue
        if any(keyword in normalized for keyword in keywords) or token_set.intersection(keywords):
            matched.append(topic)
    return matched


def _topic_role_boost(entry: dict, query: str, terms: list[str], intents: set[str]):
    profiles = _detect_topic_profiles(query, terms)
    if not profiles:
        return 0.0

    url = str(entry.get("url") or "")
    provenance = entry.get("provenance") or {}
    source_url = provenance.get("source") if isinstance(provenance, dict) else ""
    host = _extract_host(url) or _extract_host(source_url)
    lowered_url = f"{url} {source_url}".lower()
    source_hosts = _load_registered_source_hosts()
    boost = 0.0

    role_weights = {
        "official_rule_source": 4.0,
        "official_glossary_source": 3.5,
        "official_contact_source": 3.0,
        "official_light_language_source": 2.5,
        "official_background_source": 1.5,
        "ngo_context_source": 1.5,
        "journalism_source": 1.0,
    }

    for topic in profiles:
        for source in topic.get("sources", []):
            if not isinstance(source, dict):
                continue
            source_id = str(source.get("sourceId") or "").strip()
            expected_host = source_hosts.get(source_id)
            if not expected_host or not host:
                continue
            if host != expected_host and not host.endswith(f".{expected_host}"):
                continue

            role = str(source.get("role") or "discovered")
            boost += role_weights.get(role, 0.5)

            for pattern in source.get("preferredPathPatterns", []):
                if isinstance(pattern, str) and pattern.lower() in lowered_url:
                    boost += 1.2

            if role == "official_contact_source" and "contact" in intents:
                boost += 2.0
            if role == "official_rule_source" and "application" in intents:
                boost += 1.8
            if role == "official_glossary_source" and any(
                token in terms for token in {"bedarfsgemeinschaft", "aufstocker", "regelbedarf", "mehrbedarf"}
            ):
                boost += 1.5
            if role == "official_light_language_source" and any(
                token in query.lower() for token in {"leicht", "leichte sprache", "einfach"}
            ):
                boost += 2.0

    return boost


def _pick_text(*values):
    for value in values:
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _normalize_db_entry(entry):
    title_de = _pick_text(entry.get("title_de"))
    title_en = _pick_text(entry.get("title_en"))
    title_easy_de = _pick_text(entry.get("title_easy_de"))
    summary_de = _pick_text(entry.get("summary_de"))
    summary_en = _pick_text(entry.get("summary_en"))
    summary_easy_de = _pick_text(entry.get("summary_easy_de"))
    content_de = _pick_text(entry.get("content_de"))
    content_en = _pick_text(entry.get("content_en"))
    content_easy_de = _pick_text(entry.get("content_easy_de"))

    normalized = {
        "id": entry.get("id"),
        "title": _pick_text(entry.get("title"), title_de, title_en, title_easy_de, entry.get("url")),
        "summary": {
            "de": summary_de,
            "en": summary_en,
            "easy_de": summary_easy_de,
        },
        "content": {
            "de": content_de,
            "en": content_en,
            "easy_de": content_easy_de,
        },
        "url": entry.get("url"),
        "topics": entry.get("topics") or [],
        "tags": entry.get("tags") or [],
        "targetGroups": entry.get("target_groups") or [],
        "validFrom": entry.get("valid_from"),
        "validUntil": entry.get("valid_until"),
        "deadline": entry.get("deadline"),
        "status": entry.get("status"),
        "firstSeen": entry.get("first_seen"),
        "lastSeen": entry.get("last_seen"),
        "sourceUnavailable": entry.get("source_unavailable") or False,
        "provenance": entry.get("provenance"),
        "qualityScores": entry.get("quality_scores"),
        "translations": entry.get("translations"),
        "domain": entry.get("domain"),
    }

    return _serialize_datetimes(normalized)

def _serialize_datetimes(obj):
    # Recursively convert datetime/date objects to ISO strings, leave None untouched
    if isinstance(obj, dict):
        return {k: _serialize_datetimes(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_serialize_datetimes(v) for v in obj]
    elif isinstance(obj, (datetime.datetime, datetime.date)):
        return obj.isoformat()
    else:
        return obj


def _extract_terms(query: str):
    normalized = (query or "").lower()
    tokens = re.findall(r"[a-zA-ZäöüÄÖÜß0-9-]{3,}", normalized)
    seen = set()
    terms = []

    for token in tokens:
        if token in STOPWORDS or token in seen:
            continue
        seen.add(token)
        terms.append(token)
        for synonym in SYNONYM_EXPANSIONS.get(token, []):
            if synonym not in seen:
                seen.add(synonym)
                terms.append(synonym)

    return terms[:8]


def _detect_intents(query: str, terms: list[str]):
    normalized = (query or "").lower()
    tokens = set(terms)
    intents = set()
    for name, keywords in INTENT_KEYWORDS.items():
        if any(keyword in normalized for keyword in keywords) or tokens.intersection(keywords):
            intents.add(name)
    return intents


def _text_blob(entry):
    summary = entry.get("summary", {}) or {}
    content = entry.get("content", {}) or {}
    return " ".join(
        [
            str(entry.get("title") or ""),
            str(summary.get("de") or summary.get("en") or ""),
            str(content.get("de") or content.get("en") or ""),
            " ".join(entry.get("topics") or []),
            " ".join(entry.get("tags") or []),
            " ".join(entry.get("targetGroups") or []),
            str(entry.get("domain") or ""),
        ]
    ).lower()


def _rerank_entries(entries: list[dict], query: str, terms: list[str]):
    intents = _detect_intents(query, terms)
    reranked = []

    for entry in entries:
        title = str(entry.get("title") or "").lower()
        blob = _text_blob(entry)
        topics = set(entry.get("topics") or [])
        target_groups = set(entry.get("targetGroups") or [])
        domain = entry.get("domain")
        score = float(entry.get("_term_score") or 0)

        if "unemployment" in intents:
            if "employment" in topics:
                score += 3.0
            if "unemployed" in target_groups:
                score += 3.0
            if "buergergeld" in blob or "bürgergeld" in blob:
                score += 4.0
            if "arbeitslosengeld" in blob:
                score += 3.5
            if "jobcenter" in blob or "arbeitsagentur" in blob:
                score += 2.5
            if domain == "benefits":
                score += 1.5
            if domain == "tools":
                score += 1.0
            if domain == "contacts":
                score += 0.5
            if "family" in topics and "family" not in intents:
                score -= 3.5
            if target_groups.issubset({"families", "single_parents"}) and "family" not in intents:
                score -= 4.0
            for phrase, penalty in NEGATIVE_HINTS["unemployment"].items():
                if phrase in blob or phrase in title:
                    score -= penalty

        if "contact" in intents and domain == "contacts":
            score += 3.0
        if "application" in intents and ("application_required" in set(entry.get("tags") or []) or domain == "tools"):
            score += 1.5
        if title and any(term in title for term in terms):
            score += 1.5
        score += _topic_role_boost(entry, query, terms, intents)

        reranked.append((score, entry))

    reranked.sort(
        key=lambda item: (
            item[0],
            float(((item[1].get("qualityScores") or {}).get("ais") or 0)),
            float(((item[1].get("qualityScores") or {}).get("iqs") or 0)),
        ),
        reverse=True,
    )

    return [entry for score, entry in reranked if score > 0.5][:6]

def query_entries(query: str, domain: str = None):
    try:
        session = SessionLocal()
        terms = _extract_terms(query)
        if not terms:
            terms = [query.strip()]

        match_clauses = []
        score_parts = []
        params = {}
        for index, term in enumerate(terms):
            key = f"q{index}"
            params[key] = f"%{term}%"
            clause = (
                f"(title_de ILIKE :{key} OR title_en ILIKE :{key} OR title_easy_de ILIKE :{key} OR "
                f"summary_de ILIKE :{key} OR summary_en ILIKE :{key} OR summary_easy_de ILIKE :{key} OR "
                f"content_de ILIKE :{key} OR content_en ILIKE :{key} OR content_easy_de ILIKE :{key})"
            )
            match_clauses.append(clause)
            score_parts.append(f"CASE WHEN {clause} THEN 1 ELSE 0 END")

        sql = f"""
        SELECT *,
               ({' + '.join(score_parts)}) AS term_score
        FROM entries
        WHERE ({' OR '.join(match_clauses)})
        """
        if domain:
            sql += " AND domain = :domain"
            params["domain"] = domain
        sql += """
        ORDER BY
            term_score DESC,
            CASE COALESCE(provenance->>'sourceTier', 'tier_unknown')
                WHEN 'tier_1_official' THEN 0
                WHEN 'tier_2_ngo_watchdog' THEN 1
                WHEN 'tier_4_academic' THEN 2
                WHEN 'tier_3_press' THEN 3
                ELSE 4
            END,
            COALESCE((quality_scores->>'ais')::numeric, 0) DESC,
            COALESCE((quality_scores->>'iqs')::numeric, 0) DESC,
            last_seen DESC NULLS LAST
        LIMIT 24
        """
        results = session.execute(text(sql), params).mappings().all()
        session.close()
        out = []
        for r in results:
            d = dict(r)
            if "id" in d and d["id"] is not None:
                d["id"] = str(d["id"])
            normalized = _normalize_db_entry(d)
            normalized["_term_score"] = d.get("term_score", 0)
            out.append(normalized)
        ranked = _rerank_entries(out, query, terms)
        for entry in ranked:
            entry.pop("_term_score", None)
        return ranked
    except Exception as e:
        print(f"DB error: {e}")
        return []

def load_core_schema():
    schema_path = os.path.join(os.path.dirname(__file__), '../../data/_schemas/core.schema.json')
    with open(schema_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def validate_entry(entry):
    schema = load_core_schema()
    try:
        jsonschema.validate(instance=entry, schema=schema)
        return True
    except jsonschema.ValidationError as e:
        print("[VALIDATION ERROR]", e)
        print("[INVALID ENTRY]", entry)
        return False

def retrieve_evidence(query: str, domain: str = None) -> list:
    results = query_entries(query, domain)
    evidence = []
    for entry in results:
        if validate_entry(entry):
            evidence.append(Evidence(source="db", content=json.dumps(entry), confidence=0.95))
    if not evidence:
        evidence.append(Evidence(source="db", content="No evidence found", confidence=0.0))
    return evidence
