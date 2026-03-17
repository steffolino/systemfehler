"""Seeded crawler for benefits domain."""

from __future__ import annotations

from typing import Dict, List, Optional
from urllib.parse import urlparse

from bs4 import BeautifulSoup

from ..shared.seeded_domain_crawler import SeededDomainCrawler
from ..shared.source_registry import SourceProfile


class SeededBenefitsCrawler(SeededDomainCrawler):
    RELATED_PATH_HINTS = {
        'arbeitsagentur.de': (
            '/arbeitslos-arbeit-finden/buergergeld/',
            '/familie-und-kinder/kinderzuschlag',
            '/lexikon/bedarfsgemeinschaft',
            '/lexikon/aufstocker',
        ),
        'bmas.de': (
            '/DE/Arbeit/Grundsicherung-Buergergeld/',
            '/DE/Leichte-Sprache/Soziale-Sicherheit/',
        ),
        'familienportal.de': (
            '/familienportal/familienleistungen/kinderzuschlag',
            '/familienportal/meta/',
        ),
    }

    def __init__(self, user_agent: str, rate_limit_delay: float = 2.0, data_dir: str = './data') -> None:
        super().__init__(
            crawler_name='benefits-seeded',
            domain='benefits',
            user_agent=user_agent,
            rate_limit_delay=rate_limit_delay,
            data_dir=data_dir,
            source_label='seed-manifest',
        )

    def default_topics(self) -> List[str]:
        return ['financial_support', 'benefits']

    def default_tags(self) -> List[str]:
        return ['benefit']

    def default_target_groups(self) -> List[str]:
        return ['general_public', 'families', 'job_seekers']

    def build_domain_fields(
        self,
        url: str,
        soup: BeautifulSoup,
        entry: Dict[str, object],
        source_profile: Optional[SourceProfile] = None,
    ) -> Dict[str, object]:
        title = str(entry.get('title') or '')
        summary = str((entry.get('summary') or {}).get('de') or '')
        content = str((entry.get('content') or {}).get('de') or '')
        text = f"{title.lower()} {summary.lower()} {content.lower()} {url.lower()}"

        fields: Dict[str, object] = {}

        if any(token in text for token in ('voraussetzung', 'anspruch', 'berechtigt', 'bedarfsgemeinschaft')):
            fields['eligibilityCriteria'] = {
                'de': summary or content[:400].strip(),
            }

        application_steps: List[Dict[str, str]] = []
        if any(token in text for token in ('antrag', 'beantragen', 'bescheid', 'weiterbewilligung')):
            application_steps.append({'de': 'Pruefen Sie die Hinweise auf der verlinkten Seite und stellen Sie den Antrag ueber die genannte Stelle oder den Onlinedienst.'})
        elif any(token in text for token in ('jobcenter.digital', 'jobcenter', 'online')) and 'antrag' in text:
            application_steps.append({'de': 'Nutzen Sie den verlinkten Onlinedienst oder wenden Sie sich an das zustaendige Jobcenter.'})
        if application_steps:
            fields['applicationSteps'] = application_steps

        if any(token in text for token in ('euro', 'regelsatz', 'regelbedarf', 'hoehe', 'höhe')):
            fields['benefitAmount'] = {
                'de': 'Die verlinkte Quelle enthaelt die aktuellen Hinweise zur Hoehe oder Zusammensetzung der Leistung.',
            }

        if any(token in text for token in ('unterlagen', 'nachweise', 'dokumente')):
            fields['requiredDocuments'] = [
                {'de': 'Pruefen Sie auf der Quellseite, welche Unterlagen und Nachweise fuer Ihren Fall verlangt werden.'}
            ]

        return fields

    def discover_related_seed_records(
        self,
        url: str,
        soup: BeautifulSoup,
        seed_record: Dict[str, object],
        source_profile: Optional[SourceProfile] = None,
    ) -> List[Dict[str, object]]:
        related: List[Dict[str, object]] = []
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
            if 'bedarfsgemeinschaft' in candidate:
                topics.extend(['bedarfsgemeinschaft', 'glossary'])
                tags.extend(['official_glossary_source', 'glossary'])
            elif 'aufstocker' in candidate:
                topics.extend(['aufstocker', 'glossary'])
                tags.extend(['official_glossary_source', 'glossary'])
            elif 'antrag-bescheid' in candidate:
                topics.extend(['application_process'])
                tags.extend(['application_required'])
            elif 'voraussetzungen' in candidate:
                topics.extend(['eligibility'])
                tags.extend(['eligibility'])
            elif 'zusammensetzung-bedarfe' in candidate:
                topics.extend(['regelbedarf', 'mehrbedarf'])
                tags.extend(['benefit_amount'])
            elif 'pflichten' in candidate:
                topics.extend(['pflichten'])
                tags.extend(['obligations'])
            elif 'kinderzuschlag' in candidate:
                topics.extend(['kinderzuschlag'])
                tags.extend(['family_benefits'])
            elif 'Leichte-Sprache' in candidate or 'leichte-sprache' in candidate:
                topics.extend(['leichte_sprache_soziale_sicherheit'])
                tags.extend(['light_language'])

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
