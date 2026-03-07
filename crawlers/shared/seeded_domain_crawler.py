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

    # ------------------------------
    # Public API
    # ------------------------------
    def crawl(self) -> List[Dict[str, Any]]:
        urls = self._load_seed_urls()
        entries: List[Dict[str, Any]] = []

        for url in urls:
            entry = self._crawl_single_url(url)
            if entry:
                entries.append(entry)

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
            if cleaned in seen:
                continue
            seen.add(cleaned)
            normalized.append(cleaned)

        return normalized[:max_urls] if max_urls > 0 else normalized

    def _crawl_single_url(self, url: str) -> Optional[Dict[str, Any]]:
        html = self.fetch_page(url)
        if not html:
            self.logger.warning(f"Skipping unavailable URL: {url}")
            return None

        soup = self.parse_html(html)
        entry = self._build_base_entry(url, soup)
        entry.update(self.build_domain_fields(url, soup, entry))

        content_checksum = self.calculate_checksum(json.dumps(entry, sort_keys=True, ensure_ascii=False))
        entry['provenance'] = self.generate_provenance(url)
        entry['provenance']['checksum'] = content_checksum
        entry['qualityScores'] = self.quality_scorer.calculate_scores(entry)

        validation = self.validator.validate_entry(entry, self.domain)
        if not validation['valid']:
            self.logger.error(f"Validation failed for {entry.get('id')} ({url})")
            for error in validation['errors']:
                self.logger.error(f"  - {error}")
            return None

        return entry

    def _build_base_entry(self, url: str, soup: BeautifulSoup) -> Dict[str, Any]:
        title = self._get_best_title(soup, seed_name=self.domain, url=url)
        summary = self._extract_summary(soup)
        content = self._extract_content(soup)
        now_iso = datetime.now(timezone.utc).isoformat()

        entry: Dict[str, Any] = {
            'id': str(uuid.uuid4()),
            'title': {'de': title},
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

        return entry

    def _extract_summary(self, soup: BeautifulSoup) -> str:
        meta_desc = self._extract_meta_tag(soup, ['description', 'og:description', 'twitter:description'])
        if meta_desc:
            return meta_desc

        for paragraph in soup.find_all('p'):
            text = self.extract_text(paragraph)
            if len(text) >= 80:
                return text

        return ''

    def _extract_content(self, soup: BeautifulSoup) -> str:
        container = soup.find('main') or soup.find('article') or soup.find('body')
        if not container:
            return ''

        parts: List[str] = []
        for paragraph in container.find_all('p'):
            text = self.extract_text(paragraph)
            if text:
                parts.append(text)
            if len(parts) >= 12:
                break

        return ' '.join(parts)
