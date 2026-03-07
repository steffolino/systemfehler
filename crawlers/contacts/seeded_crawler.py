"""Seeded crawler for contacts domain."""

from __future__ import annotations

from typing import Any, Dict, List

from bs4 import BeautifulSoup

from ..shared.seeded_domain_crawler import SeededDomainCrawler


class SeededContactsCrawler(SeededDomainCrawler):
    def __init__(self, user_agent: str, rate_limit_delay: float = 2.0, data_dir: str = './data') -> None:
        super().__init__(
            crawler_name='contacts-seeded',
            domain='contacts',
            user_agent=user_agent,
            rate_limit_delay=rate_limit_delay,
            data_dir=data_dir,
            source_label='urls-seeded',
        )

    def default_topics(self) -> List[str]:
        return ['contacts', 'public_service']

    def default_tags(self) -> List[str]:
        return ['helpline', 'official_contact']

    def default_target_groups(self) -> List[str]:
        return ['general_public', 'families', 'persons_with_disabilities']

    def build_domain_fields(self, url: str, soup: BeautifulSoup, entry: Dict[str, Any]) -> Dict[str, Any]:
        text = f"{((entry.get('title') or {}).get('de', '')).lower()} {url.lower()}"

        contact_type = 'office'
        if '115' in text or 'telefon' in text or 'helpline' in text:
            contact_type = 'helpline'
        if 'gebaerden' in text:
            contact_type = 'accessibility'

        linked_org = 'Öffentliche Verwaltung'
        if 'arbeitsagentur.de' in url:
            linked_org = 'Bundesagentur für Arbeit'
        elif 'bmbfsfj.bund.de' in url:
            linked_org = 'Bundesministerium für Bildung, Familie, Senioren, Frauen und Jugend'
        elif 'bmas.de' in url:
            linked_org = 'Bundesministerium für Arbeit und Soziales'

        return {
            'contactType': contact_type,
            'specialization': ['Bürgeranfragen', 'Leistungsinformationen'],
            'availability': {
                'hours': 'Siehe verlinkte Quelle',
                'languages': ['de'],
            },
            'linkedOrganization': linked_org,
        }
