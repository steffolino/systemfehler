"""Persistent URL state tracking for crawl seeds and discovered URLs."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional


TERMINAL_SKIP_STATUSES = {
    "invalid_url",
    "invalid_host",
    "dns_error",
    "head_failed",
    "content_empty",
    "redirect_alias",
    "canonical_alias",
}


class URLRegistry:
    """Tracks per-domain URL outcomes across crawl runs."""

    def __init__(self, data_dir: str, domain: str, normalizer):
        self.data_dir = Path(data_dir)
        self.domain = domain
        self.normalizer = normalizer
        self.path = self.data_dir / domain / "url_status.jsonl"
        self.records: Dict[str, Dict[str, Any]] = {}
        self._load()

    def _load(self) -> None:
        if not self.path.exists():
            return

        try:
            with self.path.open("r", encoding="utf-8") as handle:
                for line in handle:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        record = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    if not isinstance(record, dict):
                        continue
                    url = record.get("url")
                    if not isinstance(url, str) or not url:
                        continue
                    self.records[self.normalizer(url)] = record
        except OSError:
            return

    def persist(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.path.open("w", encoding="utf-8") as handle:
            for record in sorted(self.records.values(), key=lambda item: item.get("url", "")):
                handle.write(json.dumps(record, ensure_ascii=False) + "\n")

    def get(self, url: str) -> Optional[Dict[str, Any]]:
        normalized = self.normalizer(url)
        return self.records.get(normalized)

    def should_skip(self, url: str) -> bool:
        record = self.get(url)
        if not record:
            return False
        status = record.get("status")
        if status in TERMINAL_SKIP_STATUSES:
            return True
        if record.get("skip") is True:
            return True
        canonical_url = record.get("canonicalUrl")
        if isinstance(canonical_url, str) and canonical_url and canonical_url != self.normalizer(url):
            return True
        return False

    def get_preferred_url(self, url: str) -> str:
        record = self.get(url)
        if not record:
            return self.normalizer(url)

        for key in ("canonicalUrl", "finalUrl"):
            candidate = record.get(key)
            if isinstance(candidate, str) and candidate:
                return self.normalizer(candidate)
        return self.normalizer(url)

    def record(
        self,
        url: str,
        *,
        status: str,
        final_url: Optional[str] = None,
        canonical_url: Optional[str] = None,
        reason: Optional[str] = None,
        status_code: Optional[int] = None,
        source: str = "crawler",
        skip: Optional[bool] = None,
        extra: Optional[Dict[str, Any]] = None,
    ) -> None:
        normalized_url = self.normalizer(url)
        record = dict(self.records.get(normalized_url, {}))
        record["url"] = normalized_url
        record["domain"] = self.domain
        record["source"] = source
        record["status"] = status
        record["lastCheckedAt"] = datetime.now(timezone.utc).isoformat()

        if final_url:
            record["finalUrl"] = self.normalizer(final_url)
        if canonical_url:
            record["canonicalUrl"] = self.normalizer(canonical_url)
        if reason:
            record["reason"] = reason
        if status_code is not None:
            record["statusCode"] = status_code
        if skip is not None:
            record["skip"] = skip
        elif status in TERMINAL_SKIP_STATUSES:
            record["skip"] = True

        if extra:
            record.update(extra)

        self.records[normalized_url] = record

        alias_target = record.get("canonicalUrl") or record.get("finalUrl")
        if isinstance(alias_target, str) and alias_target and alias_target != normalized_url:
            self._upsert_alias_target(alias_target, source=source)

    def _upsert_alias_target(self, url: str, source: str) -> None:
        normalized_url = self.normalizer(url)
        record = dict(self.records.get(normalized_url, {}))
        record.setdefault("url", normalized_url)
        record.setdefault("domain", self.domain)
        record.setdefault("source", source)
        record.setdefault("status", "discovered")
        record.setdefault("skip", False)
        record["lastCheckedAt"] = datetime.now(timezone.utc).isoformat()
        self.records[normalized_url] = record

    def iter_records(self) -> Iterable[Dict[str, Any]]:
        return self.records.values()

    def summarize(self) -> List[Dict[str, Any]]:
        return sorted(self.records.values(), key=lambda item: item.get("url", ""))
