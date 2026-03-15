"""Shared crawl metrics collector for seeded crawlers."""

from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional


class CrawlMetrics:
    def __init__(self, domain: str, crawler_name: str) -> None:
        self.domain = domain
        self.crawler_name = crawler_name
        self.started_at = datetime.now(timezone.utc)
        self.seed_urls = 0
        self.processed_urls = 0
        self.entries_extracted = 0
        self.fetch_failures = 0
        self.validation_failures = 0
        self.redirect_aliases = 0
        self.canonical_aliases = 0
        self.empty_summary = 0
        self.empty_content = 0
        self.host_counter: Counter[str] = Counter()
        self.status_counter: Counter[str] = Counter()
        self.failure_reason_counter: Counter[str] = Counter()
        self.source_tier_counter: Counter[str] = Counter()
        self.institution_type_counter: Counter[str] = Counter()
        self.target_group_counter: Counter[str] = Counter()
        self.topic_counter: Counter[str] = Counter()
        self.tag_counter: Counter[str] = Counter()
        self.iqs_values: List[float] = []
        self.ais_values: List[float] = []
        self.low_quality_urls: List[Dict[str, Any]] = []

    def note_seed_urls(self, urls: Iterable[str]) -> None:
        url_list = list(urls)
        self.seed_urls = len(url_list)
        for url in url_list:
            host = self._host(url)
            if host:
                self.host_counter[host] += 1

    def note_url_status(self, status: str, reason: Optional[str] = None) -> None:
        self.processed_urls += 1
        self.status_counter[status] += 1
        if reason:
            self.failure_reason_counter[reason] += 1
        if status == "fetch_failed":
            self.fetch_failures += 1
        if status == "validation_failed":
            self.validation_failures += 1
        if status == "redirect_alias":
            self.redirect_aliases += 1
        if status == "canonical_alias":
            self.canonical_aliases += 1

    def note_entry(self, entry: Dict[str, Any]) -> None:
        self.entries_extracted += 1
        summary = (entry.get("summary") or {}).get("de")
        content = (entry.get("content") or {}).get("de")
        if not summary:
            self.empty_summary += 1
        if not content:
            self.empty_content += 1

        provenance = entry.get("provenance") or {}
        self.source_tier_counter[str(provenance.get("sourceTier") or "tier_unknown")] += 1
        self.institution_type_counter[str(provenance.get("institutionType") or "unknown")] += 1

        for topic in entry.get("topics") or []:
            self.topic_counter[str(topic)] += 1
        for tag in entry.get("tags") or []:
            self.tag_counter[str(tag)] += 1
        for group in entry.get("targetGroups") or []:
            self.target_group_counter[str(group)] += 1

        quality = entry.get("qualityScores") or {}
        iqs = self._float_or_none(quality.get("iqs"))
        ais = self._float_or_none(quality.get("ais"))
        if iqs is not None:
            self.iqs_values.append(iqs)
        if ais is not None:
            self.ais_values.append(ais)
        if (iqs is not None and iqs < 60) or (ais is not None and ais < 60):
            self.low_quality_urls.append(
                {
                    "url": entry.get("url"),
                    "title": entry.get("title"),
                    "iqs": iqs,
                    "ais": ais,
                }
            )

    def build_report(self, url_registry_records: Optional[Iterable[Dict[str, Any]]] = None) -> Dict[str, Any]:
        finished_at = datetime.now(timezone.utc)
        registry_statuses = Counter()
        registry_failures = Counter()
        if url_registry_records:
            for record in url_registry_records:
                status = str(record.get("status") or "unknown")
                registry_statuses[status] += 1
                reason = record.get("reason")
                if reason:
                    registry_failures[str(reason)] += 1

        report = {
            "version": "0.1.0",
            "domain": self.domain,
            "crawler": self.crawler_name,
            "startedAt": self.started_at.isoformat(),
            "finishedAt": finished_at.isoformat(),
            "durationSeconds": round((finished_at - self.started_at).total_seconds(), 3),
            "counts": {
                "seedUrls": self.seed_urls,
                "processedUrls": self.processed_urls,
                "entriesExtracted": self.entries_extracted,
                "fetchFailures": self.fetch_failures,
                "validationFailures": self.validation_failures,
                "redirectAliases": self.redirect_aliases,
                "canonicalAliases": self.canonical_aliases,
                "emptySummary": self.empty_summary,
                "emptyContent": self.empty_content,
            },
            "quality": {
                "avgIqs": self._average(self.iqs_values),
                "avgAis": self._average(self.ais_values),
                "lowQualityCount": len(self.low_quality_urls),
                "lowQualitySamples": self.low_quality_urls[:10],
            },
            "distribution": {
                "hosts": self.host_counter.most_common(15),
                "sourceTier": self.source_tier_counter.most_common(),
                "institutionType": self.institution_type_counter.most_common(),
                "topics": self.topic_counter.most_common(15),
                "tags": self.tag_counter.most_common(15),
                "targetGroups": self.target_group_counter.most_common(15),
            },
            "urlRegistry": {
                "statuses": registry_statuses.most_common(),
                "failureReasons": registry_failures.most_common(),
            },
            "improvementHints": self._build_improvement_hints(registry_statuses, registry_failures),
        }
        return report

    def _build_improvement_hints(self, registry_statuses: Counter[str], registry_failures: Counter[str]) -> List[str]:
        hints: List[str] = []
        if self.fetch_failures > 0:
            hints.append("Investigate network, robots, or host restrictions for failed seeds.")
        if self.validation_failures > 0:
            hints.append("Validation failures occurred; inspect candidate field mapping before promoting entries.")
        if self.empty_summary > 0 or self.empty_content > 0:
            hints.append("Improve summary/content extraction for thin or chrome-heavy pages.")
        if registry_statuses.get("canonical_alias", 0) > 0 or registry_statuses.get("redirect_alias", 0) > 0:
            hints.append("Refresh urls.json from preferred canonical URLs to reduce alias churn.")
        if any(count > 0 for reason, count in registry_failures.items() if reason in {"fetch_failed", "validation_failed"}):
            hints.append("Use failure reasons to suppress noisy seeds or create manual-review candidates.")
        if len(self.low_quality_urls) > 0:
            hints.append("Low-quality entries detected; prioritize those URLs for recrawl, manual cleanup, or extraction tuning.")
        if not hints:
            hints.append("No major crawl issues detected in this run.")
        return hints

    def _host(self, url: str) -> str:
        if "://" not in url:
            return ""
        try:
            host = url.split("/")[2].lower()
        except Exception:
            return ""
        return host[4:] if host.startswith("www.") else host

    def _float_or_none(self, value: Any) -> Optional[float]:
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    def _average(self, values: List[float]) -> Optional[float]:
        if not values:
            return None
        return round(sum(values) / len(values), 2)
