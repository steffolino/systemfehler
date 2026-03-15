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
        seed_records = self._load_seed_records()
        entries: List[Dict[str, Any]] = []

        try:
            for seed_record in seed_records:
                entry = self._crawl_single_url(seed_record)
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

    def build_domain_fields(
        self,
        url: str,
        soup: BeautifulSoup,
        entry: Dict[str, Any],
        seed: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        return {}

    # ------------------------------
    # Internals
    # ------------------------------
    def _normalize_seed_record(self, raw_seed: Any) -> Optional[Dict[str, Any]]:
        if isinstance(raw_seed, str):
            return {'url': raw_seed.strip(), 'enabled': True}

        if not isinstance(raw_seed, dict):
            return None

        url = raw_seed.get('url')
        if not isinstance(url, str) or not url.strip():
            return None

        record: Dict[str, Any] = {
            'url': url.strip(),
            'enabled': raw_seed.get('enabled', True) is not False,
        }

        for key in (
            'label',
            'sourceTier',
            'institutionType',
            'jurisdiction',
            'seedCategory',
            'notes',
            'source',
        ):
            value = raw_seed.get(key)
            if isinstance(value, str) and value.strip():
                record[key] = value.strip()

        for key in ('topics', 'tags', 'targetGroups', 'allowedPaths'):
            value = raw_seed.get(key)
            if isinstance(value, list):
                cleaned = [item.strip() for item in value if isinstance(item, str) and item.strip()]
                if cleaned:
                    record[key] = cleaned

        priority = raw_seed.get('priority')
        if isinstance(priority, int):
            record['priority'] = priority

        return record

    def _load_seed_records(self) -> List[Dict[str, Any]]:
        seed_file = self.data_dir / self.domain / 'seeds.json'
        url_file = self.data_dir / self.domain / 'urls.json'
        payload: Any = None
        source_file = seed_file if seed_file.exists() else url_file

        if not source_file.exists():
            self.logger.warning(f"Seed file missing: {source_file}")
            return []

        try:
            payload = json.loads(source_file.read_text(encoding='utf-8'))
        except Exception as exc:
            self.logger.error(f"Failed to parse {source_file}: {exc}")
            return []

        raw_seeds = []
        if isinstance(payload, dict):
            if isinstance(payload.get('seeds'), list):
                raw_seeds = payload.get('seeds', [])
            elif isinstance(payload.get('urls'), list):
                raw_seeds = payload.get('urls', [])

        if not isinstance(raw_seeds, list):
            return []

        max_urls = 0
        max_urls_env = os.getenv('CRAWLER_MAX_URLS')

        if max_urls_env:
            try:
                max_urls = max(1, int(max_urls_env))
            except ValueError:
                max_urls = 0

        normalized: List[Dict[str, Any]] = []
        seen = set()
        seed_records = []
        for raw_seed in raw_seeds:
            seed_record = self._normalize_seed_record(raw_seed)
            if not seed_record or not seed_record.get('enabled', True):
                continue
            seed_records.append(seed_record)

        seed_records.sort(key=lambda record: record.get('priority', 100))

        for seed_record in seed_records:
            cleaned = self.normalize_url(seed_record['url'])
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
            normalized_record = dict(seed_record)
            normalized_record['url'] = cleaned
            normalized.append(normalized_record)

        return normalized[:max_urls] if max_urls > 0 else normalized

    def _merge_string_lists(self, base: List[str], extra: List[str]) -> List[str]:
        merged = []
        seen = set()
        for value in [*base, *extra]:
            if not isinstance(value, str) or not value.strip():
                continue
            cleaned = value.strip()
            if cleaned in seen:
                continue
            seen.add(cleaned)
            merged.append(cleaned)
        return merged

    def _crawl_single_url(self, seed_record: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        url = seed_record['url']
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
        if isinstance(seed_record.get('topics'), list):
            entry['topics'] = self._merge_string_lists(entry.get('topics', []), seed_record['topics'])
        if isinstance(seed_record.get('tags'), list):
            entry['tags'] = self._merge_string_lists(entry.get('tags', []), seed_record['tags'])
        if isinstance(seed_record.get('targetGroups'), list):
            entry['targetGroups'] = self._merge_string_lists(
                entry.get('targetGroups', []),
                seed_record['targetGroups'],
            )

        entry.update(self.build_domain_fields(canonical_url, soup, entry, seed_record))

        content_checksum = self.calculate_checksum(json.dumps(entry, sort_keys=True, ensure_ascii=False))
        provenance = self.generate_provenance(canonical_url)
        for key in ('sourceTier', 'institutionType', 'jurisdiction'):
            value = seed_record.get(key)
            if isinstance(value, str) and value:
                provenance[key] = value
        provenance.update(
            {
                key: value
                for key, value in self._extract_publication_metadata(soup).items()
                if value
            }
        )
        if isinstance(seed_record.get('label'), str):
            provenance['seedLabel'] = seed_record['label']
        if isinstance(seed_record.get('seedCategory'), str):
            provenance['seedCategory'] = seed_record['seedCategory']
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
