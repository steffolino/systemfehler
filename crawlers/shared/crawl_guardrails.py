"""Guardrails for filtering known low-signal or problematic crawl URLs."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Callable, Dict, List, Tuple
from urllib.parse import urlparse


class CrawlGuardrails:
    """Loads and applies URL block rules from `data/_crawl_guardrails/blocked_urls.json`."""

    def __init__(self, data_dir: str, normalizer: Callable[[str], str]) -> None:
        self.data_dir = Path(data_dir)
        self.normalizer = normalizer
        self.path = self.data_dir / "_crawl_guardrails" / "blocked_urls.json"
        rules = self._load_rules()

        self.blocked_hosts = {host.lower() for host in rules.get("blockedHosts", []) if isinstance(host, str) and host.strip()}
        self.blocked_host_suffixes = {
            suffix.lower() for suffix in rules.get("blockedHostSuffixes", []) if isinstance(suffix, str) and suffix.strip()
        }
        self.blocked_url_contains = {
            token.lower() for token in rules.get("blockedUrlContains", []) if isinstance(token, str) and token.strip()
        }
        self.blocked_url_exact = {
            self.normalizer(url) for url in rules.get("blockedUrlExact", []) if isinstance(url, str) and url.strip()
        }

    def _load_rules(self) -> Dict[str, List[str]]:
        if not self.path.exists():
            return {}
        try:
            payload = json.loads(self.path.read_text(encoding="utf-8"))
        except Exception:
            return {}
        if not isinstance(payload, dict):
            return {}
        return payload

    def is_blocked(self, url: str) -> Tuple[bool, str]:
        normalized = self.normalizer(url)
        lowered = normalized.lower()
        if normalized in self.blocked_url_exact:
            return True, "exact_url_blocklist"

        parsed = urlparse(normalized)
        host = parsed.netloc.lower()
        host_trimmed = host[4:] if host.startswith("www.") else host
        if host in self.blocked_hosts or host_trimmed in self.blocked_hosts:
            return True, "blocked_host"
        if any(host_trimmed == suffix or host_trimmed.endswith(f".{suffix}") for suffix in self.blocked_host_suffixes):
            return True, "blocked_host_suffix"
        if any(token in lowered for token in self.blocked_url_contains):
            return True, "blocked_url_token"
        return False, ""
