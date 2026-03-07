"""Seeded crawler for organizations domain."""

from __future__ import annotations

from typing import Any, Dict, List

from bs4 import BeautifulSoup

from ..shared.seeded_domain_crawler import SeededDomainCrawler


class SeededOrganizationsCrawler(SeededDomainCrawler):
    def __init__(self, user_agent: str, rate_limit_delay: float = 2.0, data_dir: str = './data') -> None:
        super().__init__(
            crawler_name='organizations-seeded',
            domain='organizations',
            user_agent=user_agent,
            rate_limit_delay=rate_limit_delay,
            data_dir=data_dir,
            source_label='urls-seeded',
        )

    def default_topics(self) -> List[str]:
        return ['public_institutions', 'organizations']

    def default_tags(self) -> List[str]:
        return ['government', 'official_source']

    def default_target_groups(self) -> List[str]:
        return ['general_public']

    def build_domain_fields(self, url: str, soup: BeautifulSoup, entry: Dict[str, Any]) -> Dict[str, Any]:
        title = (entry.get('title') or {}).get('de', '')
        domain_host = url.split('/')[2] if '://' in url else url

        services = []
        if 'arbeitsagentur' in domain_host:
            services = ['Arbeitsvermittlung', 'Leistungsinformationen', 'Familienkasse']
        elif 'bmas' in domain_host:
            services = ['Arbeit', 'Soziales', 'Bürgerinformationen']
        elif 'bmbfsfj' in domain_host:
            services = ['Familie', 'Jugend', 'Gleichstellung']
        else:
            services = ['Informationsangebote', 'Service und Kontakt']

        return {
            'organizationType': 'government',
            'region': 'Germany',
            'services': services,
            'contactDetails': {
                'website': url,
            },
        }
