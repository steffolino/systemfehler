"""Seeded crawler for contacts domain."""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

from bs4 import BeautifulSoup

from ..shared.seeded_domain_crawler import SeededDomainCrawler
from ..shared.source_registry import SourceProfile


class SeededContactsCrawler(SeededDomainCrawler):
    RELATED_PATH_HINTS = {
        'arbeitsagentur.de': (
            '/service-bereich/so-erreichen-sie-uns',
            '/gebaerdensprache',
            '/leichte-sprache',
        ),
        'bmas.de': (
            '/DE/Service/Kontakt/',
        ),
        '115.de': (
            '/gebaerdensprache',
            '/de-leicht',
            '/kontakt',
        ),
        'gebaerdentelefon.de': (
            '/115',
        ),
        'familienportal.de': (
            '/familienportal/meta/kontakt',
        ),
    }

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

    def discover_related_seed_records(
        self,
        url: str,
        soup: BeautifulSoup,
        seed_record: Dict[str, Any],
        source_profile: Optional[SourceProfile] = None,
    ) -> List[Dict[str, Any]]:
        related: List[Dict[str, Any]] = []
        seen = set()

        current_topics = list(seed_record.get('topics') or [])
        current_tags = list(seed_record.get('tags') or [])
        current_targets = list(seed_record.get('targetGroups') or [])

        for candidate in self._extract_related_links(soup, url):
            parsed = urlparse(candidate)
            host = (parsed.netloc or '').lower()
            host = host[4:] if host.startswith('www.') else host
            allowed_fragments = self.RELATED_PATH_HINTS.get(host, ())
            if not allowed_fragments:
                continue
            if not any(fragment in candidate for fragment in allowed_fragments):
                continue
            if candidate == url or candidate in seen:
                continue
            seen.add(candidate)

            topics = list(current_topics)
            tags = list(current_tags)
            if 'gebaerdensprache' in candidate or 'gebaerdentelefon' in candidate:
                topics.extend(['contacts', 'public_service'])
                tags.extend(['official_contact_source', 'accessibility'])
            elif '/kontakt' in candidate:
                topics.extend(['contacts'])
                tags.extend(['official_contact_source', 'contact'])
            elif 'leichte-sprache' in candidate or 'de-leicht' in candidate:
                topics.extend(['contacts', 'leichte_sprache_soziale_sicherheit'])
                tags.extend(['official_contact_source', 'light_language'])

            candidate_profile = self.source_registry.resolve(candidate, self.domain)
            candidate_source = (
                candidate_profile.source_id
                if candidate_profile
                else seed_record.get('source')
                or (source_profile.source_id if source_profile else None)
            )

            related.append(
                {
                    'url': candidate,
                    'source': candidate_source,
                    'topics': list(dict.fromkeys(topics)),
                    'tags': list(dict.fromkeys(tags)),
                    'targetGroups': list(dict.fromkeys(current_targets)),
                    'enabled': True,
                }
            )

        return related
