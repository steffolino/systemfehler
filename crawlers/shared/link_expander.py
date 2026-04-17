"""Python link expander (CRAWL-03).

Scans known URLs for outgoing links, classifies likely target domain, verifies
availability, and appends discovered URLs into `data/<domain>/urls.json`.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Set, Tuple
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

from .base_crawler import BaseCrawler
from .crawl_guardrails import CrawlGuardrails
from .url_registry import URLRegistry


class LinkExpander(BaseCrawler):
    DOMAIN_HINTS = {
        'benefits': ('leistung', 'benefit', 'kindergeld', 'buergergeld', 'zuschlag', 'geld'),
        'aid': ('hilfe', 'aid', 'unterstützung', 'support', 'beratung'),
        'tools': ('tool', 'rechner', 'calculator', 'service', 'antrag', 'formular', 'lotse', 'jobsuche'),
        'organizations': ('ministerium', 'organisation', 'about', 'über-uns', 'institution'),
        'contacts': ('kontakt', 'contact', 'telefon', 'helpline', '115', 'erreichen'),
    }

    IGNORED_SCHEMES = ('mailto:', 'tel:', 'javascript:')
    IGNORED_URL_TOKENS = (
        'facebook.com/sharer',
        'twitter.com/intent',
        'x.com/intent',
        'wa.me/',
        '/newsletter',
        '/impressum',
        '/datenschutz',
        '/privacy',
        '/cookie',
        '/rechtliche-hinweise',
        '/erklaerung-barrierefreiheit',
        '/gebaerdensprache',
        '/leichte-sprache',
        '/meta/',
        '/rss',
    )

    def __init__(self, user_agent: str, rate_limit_delay: float = 2.0, data_dir: str = './data') -> None:
        super().__init__('link-expander', user_agent, rate_limit_delay)
        self.data_dir = Path(data_dir)
        self.guardrails = CrawlGuardrails(str(self.data_dir), self.normalize_url)
        self.registries: Dict[str, URLRegistry] = {}

    def expand(self, domain: str, limit: int = 50, verify: bool = True) -> Dict[str, Any]:
        seeds = self._load_domain_urls(domain)
        if not seeds:
            return {
                'domain': domain,
                'scanned': 0,
                'discovered': 0,
                'added': 0,
                'broken': 0,
                'queued': 0,
            }

        discovered_by_domain: Dict[str, Set[str]] = {k: set() for k in self.DOMAIN_HINTS.keys()}
        broken: List[str] = []
        scanned = 0
        registry = self._get_registry(domain)

        try:
            for seed in seeds[: max(1, limit)]:
                page = self.fetch_page_details(seed)
                scanned += 1
                if not page:
                    broken.append(seed)
                    registry.record(
                        seed,
                        status='fetch_failed',
                        reason='fetch_failed',
                        source='link_expander',
                    )
                    continue

                html = page['html']
                final_url = self.normalize_url(page.get('final_url') or seed)
                soup = self.parse_html(html)
                canonical_url = self._extract_canonical_url(soup, base_url=final_url) or final_url
                if final_url != self.normalize_url(seed):
                    registry.record(
                        seed,
                        status='redirect_alias',
                        final_url=final_url,
                        canonical_url=canonical_url,
                        reason='http_redirect',
                        status_code=page.get('status_code'),
                        source='link_expander',
                        skip=True,
                    )
                if canonical_url != final_url:
                    registry.record(
                        final_url,
                        status='canonical_alias',
                        final_url=final_url,
                        canonical_url=canonical_url,
                        reason='head_canonical',
                        status_code=page.get('status_code'),
                        source='link_expander',
                        skip=True,
                    )
                registry.record(
                    canonical_url,
                    status='ok',
                    final_url=final_url,
                    canonical_url=canonical_url,
                    status_code=page.get('status_code'),
                    source='link_expander',
                    skip=False,
                )

                links = self.extract_links(html, canonical_url)
                for link in links:
                    target_domain = self.classify_link(link, fallback=domain)
                    verification = self.verify_link_details(link) if verify else {'ok': True, 'final_url': link, 'status_code': None}
                    if not verification['ok']:
                        broken.append(link)
                        self._get_registry(target_domain).record(
                            link,
                            status='head_failed',
                            final_url=verification.get('final_url'),
                            reason='link_verify_failed',
                            status_code=verification.get('status_code'),
                            source='link_expander',
                        )
                        continue
                    final_link = self.normalize_url(verification.get('final_url') or link)
                    if final_link != self.normalize_url(link):
                        self._get_registry(target_domain).record(
                            link,
                            status='redirect_alias',
                            final_url=final_link,
                            canonical_url=final_link,
                            reason='http_redirect',
                            status_code=verification.get('status_code'),
                            source='link_expander',
                            skip=True,
                        )
                    self._get_registry(target_domain).record(
                        final_link,
                        status='discovered',
                        final_url=final_link,
                        canonical_url=final_link,
                        status_code=verification.get('status_code'),
                        source='link_expander',
                        skip=False,
                    )
                    discovered_by_domain[target_domain].add(final_link)
        finally:
            for current_registry in self.registries.values():
                current_registry.persist()

        added_count = 0
        queued_count = 0
        for target_domain, urls in discovered_by_domain.items():
            if not urls:
                continue
            queued_count += len(urls)
            added_count += self.add_to_url_queue(sorted(urls), target_domain)

        return {
            'domain': domain,
            'scanned': scanned,
            'discovered': sum(len(v) for v in discovered_by_domain.values()),
            'added': added_count,
            'broken': len(set(broken)),
            'queued': queued_count,
        }

    def extract_links(self, html: str, base_url: str) -> List[str]:
        soup = BeautifulSoup(html, 'lxml')
        links: List[str] = []
        seen: Set[str] = set()

        for anchor in soup.find_all('a', href=True):
            href = (anchor.get('href') or '').strip()
            if not href or href.startswith('#') or href.startswith(self.IGNORED_SCHEMES):
                continue

            candidate = self.normalize_url(urljoin(base_url, href))
            parsed = urlparse(candidate)
            if parsed.scheme not in ('http', 'https') or not parsed.netloc:
                continue
            if self._should_ignore_candidate(candidate):
                continue
            blocked, _ = self.guardrails.is_blocked(candidate)
            if blocked:
                continue
            if candidate in seen:
                continue

            seen.add(candidate)
            links.append(candidate)

        return links

    def _should_ignore_candidate(self, url: str) -> bool:
        lowered = url.lower()
        return any(token in lowered for token in self.IGNORED_URL_TOKENS)

    def classify_link(self, url: str, fallback: str = 'benefits') -> str:
        text = url.lower()
        for domain, hints in self.DOMAIN_HINTS.items():
            if any(hint in text for hint in hints):
                return domain
        return fallback if fallback in self.DOMAIN_HINTS else 'benefits'

    def verify_link(self, url: str) -> bool:
        return self.verify_link_details(url)['ok']

    def verify_link_details(self, url: str) -> Dict[str, Any]:
        try:
            response = self.session.head(url, allow_redirects=True, timeout=15)
            if response.status_code < 400:
                return {
                    'ok': True,
                    'final_url': response.url,
                    'status_code': response.status_code,
                }
            if response.status_code in (405, 403):
                get_response = self.session.get(url, timeout=20)
                return {
                    'ok': get_response.status_code < 400,
                    'final_url': get_response.url,
                    'status_code': get_response.status_code,
                }
            return {
                'ok': False,
                'final_url': response.url,
                'status_code': response.status_code,
            }
        except Exception:
            return {
                'ok': False,
                'final_url': url,
                'status_code': None,
            }

    def add_to_url_queue(self, urls: List[str], domain: str) -> int:
        urls_path = self.data_dir / domain / 'urls.json'
        urls_path.parent.mkdir(parents=True, exist_ok=True)

        if urls_path.exists():
            payload = json.loads(urls_path.read_text(encoding='utf-8'))
        else:
            payload = {
                'version': '0.1.0',
                'domain': domain,
                '_meta': {
                    'placeholder': False,
                    'seededFrom': 'crawlers/shared/link_expander.py',
                    'lastSeededAt': datetime.now(timezone.utc).date().isoformat(),
                    'note': 'Initialized by Python link expander',
                },
                'urls': [],
            }

        existing = payload.get('urls', []) if isinstance(payload, dict) else []
        if not isinstance(existing, list):
            existing = []

        seen = {self.normalize_url(u) for u in existing if isinstance(u, str)}
        added = 0
        for url in urls:
            normalized = self.normalize_url(url)
            blocked, blocked_reason = self.guardrails.is_blocked(normalized)
            if blocked:
                self._get_registry(domain).record(
                    normalized,
                    status='invalid_url',
                    reason=f'guardrail_{blocked_reason}',
                    source='link_expander',
                    skip=True,
                )
                continue
            if normalized in seen:
                continue
            existing.append(normalized)
            seen.add(normalized)
            added += 1

        payload['urls'] = existing
        meta = payload.setdefault('_meta', {})
        meta['lastSeededAt'] = datetime.now(timezone.utc).date().isoformat()
        meta['seededFrom'] = 'crawlers/shared/link_expander.py'

        payload.setdefault('_todo', [])
        if 'TODO: URLs should be discovered via link expansion per CRAWL-03 (Issue #6)' not in payload['_todo']:
            payload['_todo'].append('TODO: URLs should be discovered via link expansion per CRAWL-03 (Issue #6)')

        urls_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        return added

    def _load_domain_urls(self, domain: str) -> List[str]:
        urls_path = self.data_dir / domain / 'urls.json'
        if not urls_path.exists():
            return []

        try:
            payload = json.loads(urls_path.read_text(encoding='utf-8'))
        except Exception:
            return []

        urls = payload.get('urls', []) if isinstance(payload, dict) else []
        if not isinstance(urls, list):
            return []

        unique: List[str] = []
        seen: Set[str] = set()
        registry = self._get_registry(domain)
        for raw in urls:
            if not isinstance(raw, str):
                continue
            normalized = self.normalize_url(raw)
            blocked, blocked_reason = self.guardrails.is_blocked(normalized)
            if blocked:
                registry.record(
                    normalized,
                    status='invalid_url',
                    reason=f'guardrail_{blocked_reason}',
                    source='link_expander',
                    skip=True,
                )
                continue
            if registry.should_skip(normalized):
                continue
            preferred = registry.get_preferred_url(normalized)
            if preferred != normalized:
                registry.record(
                    normalized,
                    status='canonical_alias',
                    canonical_url=preferred,
                    reason='preferred_url_from_registry',
                    source='link_expander',
                    skip=True,
                )
                normalized = preferred
            if normalized in seen:
                continue
            seen.add(normalized)
            unique.append(normalized)

        return unique

    def _get_registry(self, domain: str) -> URLRegistry:
        registry = self.registries.get(domain)
        if registry is None:
            registry = URLRegistry(str(self.data_dir), domain, self.normalize_url)
            self.registries[domain] = registry
        return registry
