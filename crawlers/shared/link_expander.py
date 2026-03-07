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


class LinkExpander(BaseCrawler):
    DOMAIN_HINTS = {
        'benefits': ('leistung', 'benefit', 'kindergeld', 'buergergeld', 'zuschlag', 'geld'),
        'aid': ('hilfe', 'aid', 'unterstützung', 'support', 'beratung'),
        'tools': ('tool', 'rechner', 'calculator', 'service', 'antrag', 'formular', 'lotse', 'jobsuche'),
        'organizations': ('ministerium', 'organisation', 'about', 'über-uns', 'institution'),
        'contacts': ('kontakt', 'contact', 'telefon', 'helpline', '115', 'erreichen'),
    }

    IGNORED_SCHEMES = ('mailto:', 'tel:', 'javascript:')

    def __init__(self, user_agent: str, rate_limit_delay: float = 2.0, data_dir: str = './data') -> None:
        super().__init__('link-expander', user_agent, rate_limit_delay)
        self.data_dir = Path(data_dir)

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

        for seed in seeds[: max(1, limit)]:
            html = self.fetch_page(seed)
            scanned += 1
            if not html:
                broken.append(seed)
                continue

            links = self.extract_links(html, seed)
            for link in links:
                target_domain = self.classify_link(link, fallback=domain)
                if verify and not self.verify_link(link):
                    broken.append(link)
                    continue
                discovered_by_domain[target_domain].add(link)

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
            if candidate in seen:
                continue

            seen.add(candidate)
            links.append(candidate)

        return links

    def classify_link(self, url: str, fallback: str = 'benefits') -> str:
        text = url.lower()
        for domain, hints in self.DOMAIN_HINTS.items():
            if any(hint in text for hint in hints):
                return domain
        return fallback if fallback in self.DOMAIN_HINTS else 'benefits'

    def verify_link(self, url: str) -> bool:
        try:
            response = self.session.head(url, allow_redirects=True, timeout=15)
            if response.status_code < 400:
                return True
            if response.status_code in (405, 403):
                get_response = self.session.get(url, timeout=20)
                return get_response.status_code < 400
            return False
        except Exception:
            return False

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
        for raw in urls:
            if not isinstance(raw, str):
                continue
            normalized = self.normalize_url(raw)
            if normalized in seen:
                continue
            seen.add(normalized)
            unique.append(normalized)

        return unique
