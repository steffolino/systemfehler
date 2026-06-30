"""Helpers for deterministic source metadata enrichment.

The crawler registry is the single source of truth for source tier inference.
These helpers fill missing/unknown provenance fields from that registry while
leaving already curated values untouched by default.
"""

from __future__ import annotations

import urllib.parse
from datetime import datetime, timezone
from typing import Any, Optional

from crawlers.shared.source_registry import SourceProfile, SourceRegistry


UNKNOWN_VALUES = {"", "unknown", "tier_unknown", "unclassified", "undefined", "null", "none"}
DEPRECATED_TIER_VALUES = {"tier_3_contextual"}


def normalized_unknown(value: Any) -> bool:
    return str(value or "").strip().lower() in UNKNOWN_VALUES


def entry_source_tier(entry: dict[str, Any]) -> str:
    provenance = entry.get("provenance") if isinstance(entry.get("provenance"), dict) else {}
    return str(provenance.get("sourceTier") or entry.get("sourceTier") or "").strip()


def entry_institution_type(entry: dict[str, Any]) -> str:
    provenance = entry.get("provenance") if isinstance(entry.get("provenance"), dict) else {}
    return str(provenance.get("institutionType") or entry.get("institutionType") or "").strip()


def resolve_entry_source_profile(
    entry: dict[str, Any],
    domain: str,
    registry: SourceRegistry,
) -> Optional[SourceProfile]:
    url = str(entry.get("url") or "").strip()
    if not url:
        provenance = entry.get("provenance") if isinstance(entry.get("provenance"), dict) else {}
        url = str(provenance.get("source") or provenance.get("url") or "").strip()
    if not url:
        return None
    return registry.resolve(url, domain)


def entry_url(entry: dict[str, Any]) -> str:
    url = str(entry.get("url") or "").strip()
    if url:
        return url
    provenance = entry.get("provenance") if isinstance(entry.get("provenance"), dict) else {}
    return str(provenance.get("source") or provenance.get("url") or "").strip()


def url_host(url: str) -> str:
    parsed = urllib.parse.urlparse(url or "")
    host = (parsed.netloc or "").lower()
    return host[4:] if host.startswith("www.") else host


def enrich_entry_source_metadata(
    entry: dict[str, Any],
    domain: str,
    registry: SourceRegistry,
    *,
    overwrite: bool = False,
    now: Optional[datetime] = None,
) -> bool:
    """Fill unknown provenance fields from the source registry.

    Returns True when the entry was modified. Existing non-unknown tier and
    institution values are preserved unless overwrite=True.
    """

    url = entry_url(entry)
    profile = resolve_entry_source_profile(entry, domain, registry)
    if not profile:
        return False

    provenance = entry.setdefault("provenance", {})
    if not isinstance(provenance, dict):
        provenance = {}
        entry["provenance"] = provenance

    timestamp = (now or datetime.now(timezone.utc)).replace(microsecond=0).isoformat()
    changed = False

    def set_if_missing(key: str, value: str) -> None:
        nonlocal changed
        if normalized_unknown(value):
            return
        if overwrite or normalized_unknown(provenance.get(key)):
            if provenance.get(key) != value:
                provenance[key] = value
                changed = True

    def set_status(key: str, value: str) -> None:
        nonlocal changed
        if normalized_unknown(value):
            return
        if provenance.get(key) != value:
            provenance[key] = value
            changed = True

    current_tier = str(provenance.get("sourceTier") or entry.get("sourceTier") or "").strip().lower()
    tier_was_unknown = overwrite or normalized_unknown(current_tier) or current_tier in DEPRECATED_TIER_VALUES
    if tier_was_unknown and profile.source_tier and profile.source_tier != "tier_unknown":
        if provenance.get("sourceTier") != profile.source_tier:
            provenance["sourceTier"] = profile.source_tier
            changed = True
        set_status("sourceTierStatus", profile.source_tier_status)
        set_status("sourceTierResolvedFrom", "source_registry")
        set_status("sourceTierResolvedAt", timestamp)
        if profile.source_tier_status == "inferred":
            set_status("sourceTierInferredFrom", "source_registry")
            set_status("sourceTierInferredAt", timestamp)
    elif str(provenance.get("sourceTier") or entry.get("sourceTier") or "").strip() == profile.source_tier:
        set_if_missing("sourceTierStatus", profile.source_tier_status)

    if profile.source_tier_status != "inferred":
        for stale_key in ("sourceTierInferredFrom", "sourceTierInferredAt"):
            if stale_key in provenance:
                del provenance[stale_key]
                changed = True

    institution_was_unknown = overwrite or normalized_unknown(
        provenance.get("institutionType") or entry.get("institutionType")
    )
    if institution_was_unknown and profile.institution_type and profile.institution_type != "unknown":
        if provenance.get("institutionType") != profile.institution_type:
            provenance["institutionType"] = profile.institution_type
            changed = True
        provenance["institutionTypeStatus"] = "inferred"

    set_if_missing("host", url_host(url))
    set_if_missing("canonicalDomain", profile.source_domain)
    set_if_missing("sourceDomain", profile.source_domain)
    set_if_missing("sourceId", profile.source_id)
    set_if_missing("providerName", profile.name)
    set_if_missing("publisherName", profile.publisher_name or profile.name)
    set_if_missing("operatorName", profile.operator_name)
    set_if_missing("author", profile.author)
    set_if_missing("providerLevel", profile.provider_level)
    set_if_missing("jurisdiction", profile.jurisdiction)
    set_if_missing("reviewStatus", profile.review_status)

    return changed
