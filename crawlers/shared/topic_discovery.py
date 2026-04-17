"""Topic-guided URL discovery for high-quality sources.

This layer does not replace the existing crawlers. It helps rank and surface
the best URLs for a concrete topic such as ``buergergeld`` by combining:

- topic-specific trusted source roles
- host/source registry metadata
- path heuristics
- known seed URLs
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional
from urllib.parse import urlparse

from .source_registry import SourceRegistry


LOW_SIGNAL_TOKENS = (
    "/impressum",
    "/datenschutz",
    "/privacy",
    "/cookie",
    "/rss",
    "/aktuelles",
    "/presse",
    "/meta/",
    "/gebaerdensprache",
)


@dataclass(frozen=True)
class TopicSourcePreference:
    source_id: str
    role: str
    priority: str = "medium"
    preferred_path_patterns: tuple[str, ...] = ()
    seed_urls: tuple[str, ...] = ()


@dataclass(frozen=True)
class TopicDefinition:
    topic_id: str
    name: str
    domains: tuple[str, ...]
    keywords: tuple[str, ...]
    sources: tuple[TopicSourcePreference, ...] = ()


class TopicRegistry:
    def __init__(self, data_dir: str | Path) -> None:
        self.data_dir = Path(data_dir)
        self.topics = self._load_topics()

    def _load_topics(self) -> Dict[str, TopicDefinition]:
        registry_path = self.data_dir / "_topics" / "trusted_topic_sources.json"
        if not registry_path.exists():
            return {}

        payload = json.loads(registry_path.read_text(encoding="utf-8"))
        result: Dict[str, TopicDefinition] = {}
        for item in payload.get("topics", []):
            if not isinstance(item, dict):
                continue
            topic_id = str(item.get("id") or "").strip()
            if not topic_id:
                continue
            preferences: List[TopicSourcePreference] = []
            for source in item.get("sources", []):
                if not isinstance(source, dict):
                    continue
                source_id = str(source.get("sourceId") or "").strip()
                role = str(source.get("role") or "").strip()
                if not source_id or not role:
                    continue
                preferences.append(
                    TopicSourcePreference(
                        source_id=source_id,
                        role=role,
                        priority=str(source.get("priority") or "medium"),
                        preferred_path_patterns=tuple(
                            value for value in source.get("preferredPathPatterns", []) if isinstance(value, str)
                        ),
                        seed_urls=tuple(value for value in source.get("seedUrls", []) if isinstance(value, str)),
                    )
                )

            result[topic_id] = TopicDefinition(
                topic_id=topic_id,
                name=str(item.get("name") or topic_id),
                domains=tuple(value for value in item.get("domains", []) if isinstance(value, str)),
                keywords=tuple(value.lower() for value in item.get("keywords", []) if isinstance(value, str)),
                sources=tuple(preferences),
            )
        return result

    def get(self, topic_id: str) -> Optional[TopicDefinition]:
        return self.topics.get(topic_id)

    def list_topics(self) -> List[TopicDefinition]:
        return sorted(self.topics.values(), key=lambda topic: topic.topic_id)

    def match_query(self, query: str) -> List[TopicDefinition]:
        normalized = (query or "").lower()
        tokens = {token for token in normalized.replace("-", " ").split() if token}
        matches: List[tuple[int, int, int, TopicDefinition]] = []

        for topic in self.topics.values():
            exact_hits = 0
            loose_hits = 0
            specificity = 0
            for keyword in topic.keywords:
                if keyword in tokens:
                    exact_hits += 1
                    specificity = max(specificity, len(keyword))
                elif keyword in normalized:
                    loose_hits += 1
                    specificity = max(specificity, len(keyword))
            if exact_hits > 0 or loose_hits > 0:
                matches.append((exact_hits, loose_hits, specificity, topic))

        matches.sort(key=lambda item: (-item[0], -item[1], -item[2], item[3].topic_id))
        return [topic for _, _, _, topic in matches]


class TopicDiscovery:
    def __init__(self, data_dir: str | Path) -> None:
        self.data_dir = Path(data_dir)
        self.registry = TopicRegistry(self.data_dir)
        self.source_registry = SourceRegistry(self.data_dir)

    def discover(self, topic_id: str, limit: int = 50, persist: bool = True) -> Dict[str, Any]:
        topic = self.registry.get(topic_id)
        if topic is None:
            raise ValueError(f"Unknown topic: {topic_id}")

        candidates: List[Dict[str, Any]] = []
        for domain in topic.domains:
            for url in self._load_urls(domain):
                candidate = self._score_url(topic, domain, url)
                if candidate is None:
                    continue
                candidates.append(candidate)

        candidates.sort(
            key=lambda item: (
                -int(item["score"]),
                0 if item.get("priority") == "critical" else 1 if item.get("priority") == "high" else 2,
                item["url"],
            )
        )

        deduped: List[Dict[str, Any]] = []
        seen_urls: set[str] = set()
        for item in candidates:
            if item["url"] in seen_urls:
                continue
            seen_urls.add(item["url"])
            deduped.append(item)

        report = {
            "topic": topic.topic_id,
            "name": topic.name,
            "domains": list(topic.domains),
            "keywords": list(topic.keywords),
            "candidateCount": len(deduped),
            "topCandidates": deduped[: max(1, limit)],
        }

        if persist:
            output_dir = self.data_dir / "_topics" / "discovery"
            output_dir.mkdir(parents=True, exist_ok=True)
            output_path = output_dir / f"{topic.topic_id}.json"
            output_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            report["outputPath"] = str(output_path)

        return report

    def list_topics(self) -> List[Dict[str, Any]]:
        topics = []
        for topic in self.registry.list_topics():
            topics.append(
                {
                    "id": topic.topic_id,
                    "name": topic.name,
                    "domains": list(topic.domains),
                    "keywords": list(topic.keywords),
                    "sourceCount": len(topic.sources),
                }
            )
        return topics

    def match_query(self, query: str) -> List[Dict[str, Any]]:
        matches = []
        for topic in self.registry.match_query(query):
            matches.append(
                {
                    "id": topic.topic_id,
                    "name": topic.name,
                    "domains": list(topic.domains),
                    "keywords": list(topic.keywords),
                    "sourceCount": len(topic.sources),
                }
            )
        return matches

    def sync_seed_manifest(
        self,
        domain: str,
        topic_ids: Optional[List[str]] = None,
        persist: bool = True,
    ) -> Dict[str, Any]:
        requested_topics = [
            topic
            for topic in self.registry.list_topics()
            if domain in topic.domains and (not topic_ids or topic.topic_id in topic_ids)
        ]

        seed_path = self.data_dir / domain / "seeds.json"
        existing_payload: Dict[str, Any] = {}
        existing_seeds: List[Dict[str, Any]] = []
        if seed_path.exists():
            existing_payload = json.loads(seed_path.read_text(encoding="utf-8"))
            if isinstance(existing_payload, dict):
                existing_seeds = [
                    item for item in existing_payload.get("seeds", []) if isinstance(item, dict)
                ]

        merged: Dict[str, Dict[str, Any]] = {}
        for seed in existing_seeds:
            url = str(seed.get("url") or "").strip()
            if not url:
                continue
            merged[url] = dict(seed)

        added = 0
        updated = 0
        for topic in requested_topics:
            for pref in topic.sources:
                if not self._role_allowed_for_domain(domain, pref.role):
                    continue
                for url in pref.seed_urls:
                    if not isinstance(url, str) or not url.strip():
                        continue
                    normalized_url = url.strip()
                    profile = self.source_registry.get_profile_by_id(pref.source_id)
                    seed = merged.get(normalized_url, {"url": normalized_url, "enabled": True})
                    if normalized_url in merged:
                        updated += 1
                    else:
                        added += 1

                    seed["source"] = pref.source_id
                    seed["label"] = seed.get("label") or self._build_seed_label(normalized_url, topic.name)
                    topics = list(seed.get("topics") or [])
                    topics.append(topic.topic_id)
                    if domain == "benefits":
                        topics.append("financial_support")
                    elif domain == "contacts":
                        topics.append("contacts")
                    seed["topics"] = list(dict.fromkeys(topics))

                    tags = list(seed.get("tags") or [])
                    tags.extend(self._tags_for_role(pref.role))
                    seed["tags"] = list(dict.fromkeys(tags))

                    targets = list(seed.get("targetGroups") or [])
                    if profile is not None:
                        targets.extend(profile.default_target_groups)
                    seed["targetGroups"] = list(dict.fromkeys(targets))

                    merged[normalized_url] = seed

        payload = {
            "version": "0.1.0",
            "domain": domain,
            "_meta": {
                "note": f"Curated high-signal {domain} seeds enriched from trusted topic profiles",
                "maintainedBy": "codex",
                "syncedFromTrustedTopics": True,
                "topicIds": [topic.topic_id for topic in requested_topics],
            },
            "seeds": list(sorted(merged.values(), key=lambda item: str(item.get("url") or ""))),
        }

        if persist:
            seed_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

        return {
            "domain": domain,
            "topicIds": [topic.topic_id for topic in requested_topics],
            "seedCount": len(payload["seeds"]),
            "added": added,
            "updated": updated,
            "outputPath": str(seed_path),
        }

    def _load_urls(self, domain: str) -> Iterable[str]:
        path = self.data_dir / domain / "urls.json"
        if not path.exists():
            return []
        payload = json.loads(path.read_text(encoding="utf-8"))
        urls = payload.get("urls", []) if isinstance(payload, dict) else []
        return [value for value in urls if isinstance(value, str)]

    def _score_url(self, topic: TopicDefinition, domain: str, url: str) -> Optional[Dict[str, Any]]:
        normalized_url = url.strip()
        lowered = normalized_url.lower()
        if any(token in lowered for token in LOW_SIGNAL_TOKENS):
            return None

        parsed = urlparse(normalized_url)
        host = (parsed.netloc or "").lower()
        host = host[4:] if host.startswith("www.") else host
        path = parsed.path or "/"

        matched_preferences = [pref for pref in topic.sources if self._preference_matches_host(pref, host)]
        source_profile = self.source_registry.resolve(normalized_url, domain)

        score = 0
        reasons: List[str] = [f"domain:{domain}"]
        matched_role: Optional[str] = None
        matched_priority: Optional[str] = None
        source_id: Optional[str] = None

        if matched_preferences:
            best_pref = sorted(
                matched_preferences,
                key=lambda pref: 0 if pref.priority == "critical" else 1 if pref.priority == "high" else 2,
            )[0]
            matched_role = best_pref.role
            matched_priority = best_pref.priority
            source_id = best_pref.source_id
            score += {"critical": 65, "high": 48, "medium": 32}.get(best_pref.priority, 20)
            reasons.append(f"source:{best_pref.source_id}")
            reasons.append(f"role:{best_pref.role}")

            if normalized_url in best_pref.seed_urls:
                score += 50
                reasons.append("seed_url")

            pattern_hits = 0
            for pattern in best_pref.preferred_path_patterns:
                if pattern.lower() in lowered:
                    score += 18
                    pattern_hits += 1
                    reasons.append(f"path:{pattern}")
            if pattern_hits == 0 and best_pref.preferred_path_patterns:
                score -= 8
        elif source_profile is not None:
            source_id = source_profile.source_id
            if source_profile.source_tier == "tier_1_official":
                score += 26
                reasons.append("tier:official")
            elif source_profile.source_tier == "tier_2_ngo_watchdog":
                score += 18
                reasons.append("tier:ngo")

        keyword_hits = [keyword for keyword in topic.keywords if keyword in lowered]
        if keyword_hits:
            score += min(36, len(keyword_hits) * 8)
            reasons.append(f"keywords:{','.join(keyword_hits[:4])}")

        if "/lexikon/" in lowered:
            score += 24
            reasons.append("type:glossary")
        if "/leichte-sprache/" in lowered or "/leichte-sprache" in lowered:
            score += 22
            reasons.append("type:light_language")
        if "/kontakt/" in lowered or "kontaktformular" in lowered or "buergertelefon" in lowered:
            score += 18
            reasons.append("type:contact")
        if "studie" in lowered:
            score += 12
            reasons.append("type:study")

        if parsed.query:
            score -= 6
            reasons.append("query_penalty")

        if score < 20:
            return None

        return {
            "url": normalized_url,
            "domain": domain,
            "host": host,
            "score": score,
            "role": matched_role or "discovered",
            "priority": matched_priority or "normal",
            "sourceId": source_id or (source_profile.source_id if source_profile else host),
            "sourceName": source_profile.name if source_profile else host,
            "sourceTier": source_profile.source_tier if source_profile else "tier_unknown",
            "institutionType": source_profile.institution_type if source_profile else "unknown",
            "reasons": reasons,
        }

    def _preference_matches_host(self, preference: TopicSourcePreference, host: str) -> bool:
        profile = self.source_registry.get_profile_by_id(preference.source_id)
        if profile is None:
            return False
        return host == profile.host or host.endswith(f".{profile.host}")

    def _build_seed_label(self, url: str, topic_name: str) -> str:
        parsed = urlparse(url)
        path = (parsed.path or "/").rstrip("/")
        segment = path.split("/")[-1] if path and path != "/" else parsed.netloc
        segment = segment.replace("-", " ").replace("_", " ").strip()
        segment = segment or parsed.netloc
        label = " ".join(word.capitalize() for word in segment.split())
        return f"{topic_name} {label}".strip()

    def _tags_for_role(self, role: str) -> List[str]:
        mapping = {
            "official_rule_source": ["official_rule_source"],
            "official_glossary_source": ["official_glossary_source", "glossary"],
            "official_contact_source": ["official_contact_source", "contact"],
            "official_light_language_source": ["official_light_language_source", "light_language"],
            "official_background_source": ["official_background_source"],
            "ngo_context_source": ["ngo_context_source"],
            "ngo_support_source": ["ngo_support_source", "advisory", "contact"],
            "meta_support_portal_source": ["meta_support_portal_source", "directory", "contact"],
            "trusted_tool_source": ["trusted_tool_source", "calculator"],
            "trusted_glossary_source": ["trusted_glossary_source", "glossary"],
            "discovery_context_source": ["discovery_context_source", "context"],
            "journalism_source": ["journalism_source"],
        }
        return mapping.get(role, [role])

    def _role_allowed_for_domain(self, domain: str, role: str) -> bool:
        allowed_roles = {
            "benefits": {
                "official_rule_source",
                "official_glossary_source",
                "official_light_language_source",
                "official_background_source",
                "ngo_context_source",
                "journalism_source",
            },
            "contacts": {
                "official_contact_source",
                "ngo_support_source",
                "meta_support_portal_source",
            },
            "aid": {
                "official_rule_source",
                "official_glossary_source",
                "official_light_language_source",
                "official_background_source",
                "ngo_context_source",
                "ngo_support_source",
                "meta_support_portal_source",
                "trusted_glossary_source",
                "discovery_context_source",
                "journalism_source",
            },
            "tools": {
                "trusted_tool_source",
                "meta_support_portal_source",
            },
        }
        return role in allowed_roles.get(domain, {role})
