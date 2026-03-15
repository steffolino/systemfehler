"""Shared source-group registry for seeded crawlers.

The runtime crawl queue remains `data/<domain>/urls.json`, but source grouping,
trust tier, and provider metadata come from the registry under `data/_sources/`.
"""

from __future__ import annotations

import json
import urllib.parse
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional


@dataclass(frozen=True)
class SourceProfile:
    source_id: str
    name: str
    base_url: str
    domains: tuple[str, ...]
    source_tier: str = "tier_unknown"
    institution_type: str = "unknown"
    jurisdiction: str = "DE"
    provider_level: str = "unknown"
    priority: str = "normal"
    default_topics: tuple[str, ...] = ()
    default_tags: tuple[str, ...] = ()
    default_target_groups: tuple[str, ...] = ()
    services: tuple[str, ...] = ()
    extra: Dict[str, Any] = field(default_factory=dict)

    @property
    def host(self) -> str:
        parsed = urllib.parse.urlparse(self.base_url)
        host = (parsed.netloc or "").lower()
        return host[4:] if host.startswith("www.") else host

    def matches(self, url: str, domain: str) -> bool:
        parsed = urllib.parse.urlparse(url or "")
        host = (parsed.netloc or "").lower()
        host = host[4:] if host.startswith("www.") else host
        if domain not in self.domains:
            return False
        return host == self.host or host.endswith(f".{self.host}")


class SourceRegistry:
    def __init__(self, data_dir: str | Path) -> None:
        self.data_dir = Path(data_dir)
        self._profiles = self._load_profiles()

    def _load_json(self, path: Path) -> Dict[str, Any]:
        if not path.exists():
            return {}
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return {}

    def _load_profiles(self) -> List[SourceProfile]:
        registered = self._load_json(self.data_dir / "_sources" / "registered_sources.json")
        sources = registered.get("sources", []) if isinstance(registered, dict) else []

        built_profiles: List[SourceProfile] = []
        for item in sources:
            if not isinstance(item, dict):
                continue
            source_id = str(item.get("id") or "").strip()
            name = str(item.get("name") or source_id or "Unknown source").strip()
            base_url = str(item.get("baseUrl") or "").strip()
            domains = tuple(str(value) for value in item.get("domains", []) if isinstance(value, str))
            if not source_id or not base_url or not domains:
                continue

            profile = SourceProfile(
                source_id=source_id,
                name=name,
                base_url=base_url,
                domains=domains,
                source_tier=str(item.get("sourceTier") or self._infer_source_tier(base_url)),
                institution_type=str(item.get("institutionType") or self._infer_institution_type(base_url)),
                jurisdiction=str(item.get("jurisdiction") or "DE"),
                provider_level=str(item.get("providerLevel") or self._infer_provider_level(base_url)),
                priority=str(item.get("priority") or "normal"),
                default_topics=tuple(item.get("defaultTopics") or ()),
                default_tags=tuple(item.get("defaultTags") or ()),
                default_target_groups=tuple(item.get("defaultTargetGroups") or ()),
                services=tuple(item.get("services") or ()),
                extra={k: v for k, v in item.items() if k not in {
                    "id",
                    "name",
                    "baseUrl",
                    "domains",
                    "sourceTier",
                    "institutionType",
                    "jurisdiction",
                    "providerLevel",
                    "priority",
                    "defaultTopics",
                    "defaultTags",
                    "defaultTargetGroups",
                    "services",
                }},
            )
            built_profiles.append(profile)

        return built_profiles

    def _infer_source_tier(self, base_url: str) -> str:
        host = self._host(base_url)
        if host.endswith(".bund.de") or host in {
            "arbeitsagentur.de",
            "bundesregierung.de",
            "fitko.de",
            "115.de",
            "bafza.de",
        }:
            return "tier_1_official"
        if host in {
            "sanktionsfrei.de",
            "caritas.de",
            "diakonie.de",
            "weisser-ring.de",
            "telefonseelsorge.de",
            "nummergegenkummer.de",
            "dajeb.de",
            "frauenhauskoordinierung.de",
            "deutsche-depressionshilfe.de",
        }:
            return "tier_2_ngo_watchdog"
        return "tier_unknown"

    def _infer_institution_type(self, base_url: str) -> str:
        host = self._host(base_url)
        if host.endswith(".bund.de") or host in {
            "arbeitsagentur.de",
            "bundesregierung.de",
            "fitko.de",
            "115.de",
            "bafza.de",
        }:
            return "government"
        if host in {
            "sanktionsfrei.de",
            "caritas.de",
            "diakonie.de",
            "weisser-ring.de",
            "telefonseelsorge.de",
            "nummergegenkummer.de",
            "dajeb.de",
            "frauenhauskoordinierung.de",
            "deutsche-depressionshilfe.de",
        }:
            return "ngo"
        return "unknown"

    def _infer_provider_level(self, base_url: str) -> str:
        host = self._host(base_url)
        if host.endswith(".bund.de") or host in {"arbeitsagentur.de", "bundesregierung.de", "bafza.de"}:
            return "federal"
        if host in {"sanktionsfrei.de", "caritas.de", "diakonie.de"}:
            return "civil_society"
        return "unknown"

    def _host(self, url: str) -> str:
        parsed = urllib.parse.urlparse(url or "")
        host = (parsed.netloc or "").lower()
        return host[4:] if host.startswith("www.") else host

    def resolve(self, url: str, domain: str, extra_profiles: Optional[Iterable[SourceProfile]] = None) -> Optional[SourceProfile]:
        all_profiles = list(self._profiles)
        if extra_profiles:
            all_profiles.extend(extra_profiles)

        matches = [profile for profile in all_profiles if profile.matches(url, domain)]
        if not matches:
            return None

        matches.sort(
            key=lambda profile: (
                0 if profile.source_tier == "tier_1_official" else 1 if profile.source_tier == "tier_2_ngo_watchdog" else 2,
                0 if profile.priority == "high" else 1,
                len(profile.host),
            )
        )
        return matches[0]
