"""Seeded crawler for organizations domain."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from bs4 import BeautifulSoup

from ..shared.seeded_domain_crawler import SeededDomainCrawler
from ..shared.source_registry import SourceProfile


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
        return ['organizations']

    def default_tags(self) -> List[str]:
        return ['organization']

    def default_target_groups(self) -> List[str]:
        return ['general_public']

    def build_domain_fields(
        self,
        url: str,
        soup: BeautifulSoup,
        entry: Dict[str, Any],
        source_profile: Optional[SourceProfile] = None,
    ) -> Dict[str, Any]:
        organization_type = source_profile.institution_type if source_profile else 'unknown'
        services = list(source_profile.services) if source_profile and source_profile.services else []
        domain_host = url.split('/')[2] if '://' in url else url

        if not services:
            if 'arbeitsagentur' in domain_host:
                services = ['Arbeitsvermittlung', 'Leistungsinformationen', 'Familienkasse']
            elif 'bmas' in domain_host:
                services = ['Arbeit', 'Soziales', 'Buergerinformationen']
            elif 'bmbfsfj' in domain_host:
                services = ['Familie', 'Jugend', 'Gleichstellung']
            elif 'sanktionsfrei.de' in domain_host:
                services = ['Buergergeld-Beratung', 'Sozialrechtsinformation', 'Unterstuetzung bei Jobcenter-Themen']
            else:
                services = ['Informationsangebote', 'Service und Kontakt']

        return {
            'organizationType': organization_type,
            'region': 'Germany',
            'services': services,
            'contactDetails': {
                'website': url,
            },
        }
