"""Seeded crawler for tools domain."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from bs4 import BeautifulSoup

from ..shared.seeded_domain_crawler import SeededDomainCrawler
from ..shared.source_registry import SourceProfile


class SeededToolsCrawler(SeededDomainCrawler):
    def __init__(self, user_agent: str, rate_limit_delay: float = 2.0, data_dir: str = './data') -> None:
        super().__init__(
            crawler_name='tools-seeded',
            domain='tools',
            user_agent=user_agent,
            rate_limit_delay=rate_limit_delay,
            data_dir=data_dir,
            source_label='urls-seeded',
        )

    def default_topics(self) -> List[str]:
        return ['digital_service', 'tools']

    def default_tags(self) -> List[str]:
        return ['tool']

    def default_target_groups(self) -> List[str]:
        return ['general_public', 'families', 'job_seekers']

    def build_domain_fields(
        self,
        url: str,
        soup: BeautifulSoup,
        entry: Dict[str, Any],
        source_profile: Optional[SourceProfile] = None,
    ) -> Dict[str, Any]:
        title = str(entry.get('title') or '')
        text = f"{title.lower()} {url.lower()}"

        tool_type = 'portal'
        if any(token in text for token in ('rechner', 'calculator')):
            tool_type = 'calculator'
        elif any(token in text for token in ('antrag', 'apply', 'beantragen')):
            tool_type = 'application'
        elif 'jobsuche' in text:
            tool_type = 'job-search'
        elif 'lotse' in text or 'check' in text:
            tool_type = 'checker'

        return {
            'toolType': tool_type,
            'relatedBenefits': [],
            'accessibility': {
                'languages': ['de'],
                'screenReaderCompatible': True,
            },
        }
