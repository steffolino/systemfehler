"""Generic seeded domain crawler.

Uses domain-specific `data/<domain>/urls.json` as crawl seeds and emits
schema-valid candidate entries with lightweight extraction.
"""

from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from bs4 import BeautifulSoup

from .base_crawler import BaseCrawler
from .quality_scorer import QualityScorer
from .url_registry import URLRegistry
from .validator import SchemaValidator


class SeededDomainCrawler(BaseCrawler):
    """Shared crawler implementation for URL-seeded domains."""

    def __init__(
        self,
        crawler_name: str,
        domain: str,
        user_agent: str,
        rate_limit_delay: float = 2.0,
        data_dir: str = './data',
        source_label: str = 'seeded',
    ) -> None:
        super().__init__(crawler_name, user_agent, rate_limit_delay)
        self.domain = domain
        self.data_dir = Path(data_dir)
        self.source_label = source_label
        self.quality_scorer = QualityScorer()
        self.validator = SchemaValidator()
        self.url_registry = URLRegistry(str(self.data_dir), domain, self.normalize_url)

    # ------------------------------
    # Public API
    # ------------------------------
    def crawl(self) -> List[Dict[str, Any]]:
        urls = self._load_seed_urls()
        entries: List[Dict[str, Any]] = []

        try:
            for url in urls:
                entry = self._crawl_single_url(url)
                if entry:
                    entries.append(entry)
        finally:
            self.url_registry.persist()

        return entries

    def save_candidates(self, entries: List[Dict[str, Any]], output_path: str) -> None:
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)

        output_data = {
            'version': '0.1.0',
            'domain': self.domain,
            'crawlDate': datetime.now(timezone.utc).isoformat(),
            'source': self.source_label,
            'entries': entries,
        }

        output_file.write_text(json.dumps(output_data, indent=2, ensure_ascii=False), encoding='utf-8')
        self.logger.info(f"Saved {len(entries)} candidate entries to {output_file}")

    # ------------------------------
    # Overridables
    # ------------------------------
    def default_topics(self) -> List[str]:
        return [self.domain]

    def default_tags(self) -> List[str]:
        return [self.domain]

    def default_target_groups(self) -> List[str]:
        return ['general_public']

    def build_domain_fields(self, url: str, soup: BeautifulSoup, entry: Dict[str, Any]) -> Dict[str, Any]:
        return {}

    # ------------------------------
    # Internals
    # ------------------------------
    def _load_seed_urls(self) -> List[str]:
        url_file = self.data_dir / self.domain / 'urls.json'
        if not url_file.exists():
            self.logger.warning(f"Seed URL file missing: {url_file}")
            return []

        try:
            payload = json.loads(url_file.read_text(encoding='utf-8'))
        except Exception as exc:
            self.logger.error(f"Failed to parse {url_file}: {exc}")
            return []

        urls = payload.get('urls', []) if isinstance(payload, dict) else []
        if not isinstance(urls, list):
            return []

        max_urls = 0
        max_urls_env = os.getenv('CRAWLER_MAX_URLS')

        if max_urls_env:
            try:
                max_urls = max(1, int(max_urls_env))
            except ValueError:
                max_urls = 0

        normalized = []
        seen = set()
        for raw_url in urls:
            if not isinstance(raw_url, str) or not raw_url.strip():
                continue
            cleaned = self.normalize_url(raw_url)
            if self.url_registry.should_skip(cleaned):
                continue
            preferred = self.url_registry.get_preferred_url(cleaned)
            if preferred != cleaned:
                self.url_registry.record(
                    cleaned,
                    status='canonical_alias',
                    canonical_url=preferred,
                    reason='preferred_url_from_registry',
                    source='seeded_domain_crawler',
                    skip=True,
                )
                cleaned = preferred
            if cleaned in seen:
                continue
            seen.add(cleaned)
            normalized.append(cleaned)

        return normalized[:max_urls] if max_urls > 0 else normalized

    def _crawl_single_url(self, url: str) -> Optional[Dict[str, Any]]:
        response = self.fetch_page_details(url)
        if not response:
            self.url_registry.record(
                url,
                status='fetch_failed',
                reason='fetch_failed',
                source='seeded_domain_crawler',
            )
            self.logger.warning(f"Skipping unavailable URL: {url}")
            return None

        html = response['html']
        soup = self.parse_html(html)
        final_url = self.normalize_url(response.get('final_url') or url)
        canonical_url = self._extract_canonical_url(soup, base_url=final_url) or final_url

        if final_url != self.normalize_url(url):
            self.url_registry.record(
                url,
                status='redirect_alias',
                final_url=final_url,
                canonical_url=canonical_url,
                reason='http_redirect',
                status_code=response.get('status_code'),
                source='seeded_domain_crawler',
                skip=True,
            )

        if canonical_url != final_url:
            self.url_registry.record(
                final_url,
                status='canonical_alias',
                final_url=final_url,
                canonical_url=canonical_url,
                reason='head_canonical',
                status_code=response.get('status_code'),
                source='seeded_domain_crawler',
                skip=True,
            )

        self.url_registry.record(
            canonical_url,
            status='ok',
            final_url=final_url,
            canonical_url=canonical_url,
            status_code=response.get('status_code'),
            source='seeded_domain_crawler',
            skip=False,
        )

        entry = self._build_base_entry(canonical_url, soup)
        entry.update(self.build_domain_fields(canonical_url, soup, entry))

        content_checksum = self.calculate_checksum(json.dumps(entry, sort_keys=True, ensure_ascii=False))
        provenance = self.generate_provenance(canonical_url)
        provenance.update(
            {
                key: value
                for key, value in self._extract_publication_metadata(soup).items()
                if value
            }
        )
        provenance['checksum'] = content_checksum
        entry['provenance'] = provenance
        entry['qualityScores'] = self.quality_scorer.calculate_scores(entry)

        validation = self.validator.validate_entry(entry, self.domain)
        if not validation['valid']:
            self.logger.error(f"Validation failed for {entry.get('id')} ({url})")
            for error in validation['errors']:
                self.logger.error(f"  - {error}")
            self.url_registry.record(
                canonical_url,
                status='validation_failed',
                final_url=final_url,
                canonical_url=canonical_url,
                reason='validation_failed',
                status_code=response.get('status_code'),
                source='seeded_domain_crawler',
            )
            return None

        return entry

    def _build_base_entry(self, url: str, soup: BeautifulSoup) -> Dict[str, Any]:
        title = self._get_best_title(soup, seed_name=self.domain, url=url)
        summary = self._extract_summary(soup)
        content = self._extract_content(soup)
        head_title = self._extract_head_title(soup)
        head_description = self._extract_meta_tag(
            soup,
            ['description', 'og:description', 'twitter:description'],
        )
        now_iso = datetime.now(timezone.utc).isoformat()

        entry: Dict[str, Any] = {
            'id': str(uuid.uuid4()),
            'title': title,
            'summary': {'de': summary} if summary else {'de': title},
            'content': {'de': content} if content else {'de': summary or title},
            'url': self.normalize_url(url),
            'topics': self.default_topics(),
            'tags': self.default_tags(),
            'targetGroups': self.default_target_groups(),
            'status': 'active',
            'firstSeen': now_iso,
            'lastSeen': now_iso,
            'sourceUnavailable': False,
        }

        if head_title or head_description:
            entry['head'] = {
                'title': head_title,
                'description': head_description,
            }

        return entry

    def _extract_summary(self, soup: BeautifulSoup) -> str:
        return self._extract_best_summary(soup)

    def _extract_content(self, soup: BeautifulSoup) -> str:
        summary = self._extract_summary(soup)
        return self._extract_best_content(soup, summary=summary, max_parts=6)
