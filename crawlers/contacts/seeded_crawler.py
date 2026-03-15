"""Seeded crawler for contacts domain."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from bs4 import BeautifulSoup

from ..shared.seeded_domain_crawler import SeededDomainCrawler
from ..shared.source_registry import SourceProfile


class SeededContactsCrawler(SeededDomainCrawler):
    def __init__(self, user_agent: str, rate_limit_delay: float = 2.0, data_dir: str = './data') -> None:
        super().__init__(
            crawler_name='contacts-seeded',
            domain='contacts',
            user_agent=user_agent,
            rate_limit_delay=rate_limit_delay,
            data_dir=data_dir,
            source_label='seed-manifest',
        )

    def default_topics(self) -> List[str]:
        return ['contacts', 'public_service']

    def default_tags(self) -> List[str]:
        return ['contact']

    def default_target_groups(self) -> List[str]:
        return ['general_public', 'families', 'persons_with_disabilities']

    def build_domain_fields(
        self,
        url: str,
        soup: BeautifulSoup,
        entry: Dict[str, Any],
        source_profile: Optional[SourceProfile] = None,
    ) -> Dict[str, Any]:
        title = str(entry.get('title') or '')
        text = f"{title.lower()} {url.lower()}"

        contact_type = 'office'
        if '115' in text or 'telefon' in text or 'helpline' in text:
            contact_type = 'helpline'
        if 'gebaerden' in text:
            contact_type = 'accessibility'
        if 'sanktionsfrei.de' in text or 'beratung' in text or 'faq' in text:
            contact_type = 'advisor'

        linked_org = source_profile.name if source_profile else 'Oeffentliche Verwaltung'
        specialization = list(source_profile.services) if source_profile and source_profile.services else [
            'Buergeranfragen',
            'Leistungsinformationen',
        ]
        if 'arbeitsagentur.de' in url:
            linked_org = 'Bundesagentur fuer Arbeit'
            if not specialization:
                specialization = ['Arbeitsvermittlung', 'Leistungsinformationen']
        elif 'bmbfsfj.bund.de' in url:
            linked_org = 'Bundesministerium fuer Bildung, Familie, Senioren, Frauen und Jugend'
        elif 'bmas.de' in url:
            linked_org = 'Bundesministerium fuer Arbeit und Soziales'
        elif 'sanktionsfrei.de' in url:
            linked_org = 'Sanktionsfrei'
            specialization = ['Buergergeld', 'Jobcenter', 'Sozialrechtsberatung']

        return {
            'contactType': contact_type,
            'specialization': specialization,
            'availability': {
                'hours': 'Siehe verlinkte Quelle',
                'languages': ['de'],
            },
            'linkedOrganization': linked_org,
        }
