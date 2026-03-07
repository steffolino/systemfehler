"""Seeded crawler for aid domain."""

from __future__ import annotations

from typing import Any, Dict, List

from bs4 import BeautifulSoup

from ..shared.seeded_domain_crawler import SeededDomainCrawler


class SeededAidCrawler(SeededDomainCrawler):
    def __init__(self, user_agent: str, rate_limit_delay: float = 2.0, data_dir: str = './data') -> None:
        super().__init__(
            crawler_name='aid-seeded',
            domain='aid',
            user_agent=user_agent,
            rate_limit_delay=rate_limit_delay,
            data_dir=data_dir,
            source_label='urls-seeded',
        )

    def default_topics(self) -> List[str]:
        return ['financial_support', 'aid']

    def default_tags(self) -> List[str]:
        return ['application_required', 'public_service']

    def default_target_groups(self) -> List[str]:
        return ['families', 'single_parents', 'general_public']

    def build_domain_fields(self, url: str, soup: BeautifulSoup, entry: Dict[str, Any]) -> Dict[str, Any]:
        title = (entry.get('title') or {}).get('de', '').lower()
        summary = (entry.get('summary') or {}).get('de', '').lower()
        text = f"{title} {summary} {url.lower()}"

        aid_type = 'advisory'
        modality = 'information'
        if any(token in text for token in ('geld', 'zuschlag', 'finanz', 'leistung', 'unterhalt')):
            aid_type = 'financial'
            modality = 'application'

        provider = 'Bundesministerium für Bildung, Familie, Senioren, Frauen und Jugend'
        if 'arbeitsagentur.de' in url:
            provider = 'Bundesagentur für Arbeit'

        return {
            'aidType': aid_type,
            'modality': modality,
            'eligibilityCriteria': {
                'de': 'Anspruch und Voraussetzungen sind in der jeweiligen Leistungsbeschreibung der Quelle dokumentiert.'
            },
            'providingOrganization': provider,
        }
