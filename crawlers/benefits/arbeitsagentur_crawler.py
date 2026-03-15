"""
Systemfehler Arbeitsagentur Benefits Crawler

Crawls benefits information from Bundesagentur für Arbeit - Bürgergeld page.
Target URL: https://www.arbeitsagentur.de/arbeitslosengeld-2
"""

import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional

from bs4 import BeautifulSoup

from ..shared.base_crawler import BaseCrawler
from ..shared.quality_scorer import QualityScorer
from ..shared.url_registry import URLRegistry
from ..shared.validator import SchemaValidator
from ..shared.diff_generator import DiffGenerator


class ArbeitsagenturCrawler(BaseCrawler):
    """Crawler for Arbeitsagentur benefits information"""
    
    TARGET_URL = "https://www.arbeitsagentur.de/arbeitslos-arbeit-finden/buergergeld"
    LEGACY_URLS = (
        "https://www.arbeitsagentur.de/arbeitslosengeld-2",
    )
    
    def __init__(self, user_agent: str, rate_limit_delay: float = 2.0):
        super().__init__('arbeitsagentur', user_agent, rate_limit_delay)
        self.quality_scorer = QualityScorer()
        self.validator = SchemaValidator()
        self.diff_generator = DiffGenerator()
        self.url_registry = URLRegistry('./data', 'benefits', self.normalize_url)
    
    def crawl(self) -> List[Dict[str, Any]]:
        """
        Main crawl method
        
        Returns:
            List of candidate benefit entries
        """
        self.logger.info(f"Starting crawl of {self.TARGET_URL}")
        
        # Fetch the page
        response = self.fetch_page_details(self.TARGET_URL)
        if not response:
            self.url_registry.record(
                self.TARGET_URL,
                status='fetch_failed',
                reason='fetch_failed',
                source='arbeitsagentur_crawler',
            )
            self.url_registry.persist()
            self.logger.error("Failed to fetch page")
            return []
        
        # Parse and extract data
        html = response['html']
        soup = self.parse_html(html)
        final_url = self.normalize_url(response.get('final_url') or self.TARGET_URL)
        canonical_url = self._extract_canonical_url(soup, base_url=final_url) or final_url

        if final_url != self.normalize_url(self.TARGET_URL):
            self.url_registry.record(
                self.TARGET_URL,
                status='redirect_alias',
                final_url=final_url,
                canonical_url=canonical_url,
                reason='http_redirect',
                status_code=response.get('status_code'),
                source='arbeitsagentur_crawler',
                skip=True,
            )

        if canonical_url != final_url:
            self.url_registry.record(
                final_url,
                status='canonical_alias',
                final_url=final_url,
                canonical_url=canonical_url,
                reason='head_canonical',
                status_code=response.get('status_code'),
                source='arbeitsagentur_crawler',
                skip=True,
            )

        self.url_registry.record(
            canonical_url,
            status='ok',
            final_url=final_url,
            canonical_url=canonical_url,
            status_code=response.get('status_code'),
            source='arbeitsagentur_crawler',
            skip=False,
        )
        for legacy_url in self.LEGACY_URLS:
            self.url_registry.record(
                legacy_url,
                status='canonical_alias',
                final_url=legacy_url,
                canonical_url=canonical_url,
                reason='known_legacy_alias',
                status_code=response.get('status_code'),
                source='arbeitsagentur_crawler',
                skip=True,
            )

        entry = self.extract_benefit_entry(soup)
        
        if not entry:
            self.url_registry.record(
                canonical_url,
                status='content_empty',
                final_url=final_url,
                canonical_url=canonical_url,
                reason='extraction_failed',
                status_code=response.get('status_code'),
                source='arbeitsagentur_crawler',
            )
            self.url_registry.persist()
            self.logger.error("Failed to extract benefit data")
            return []
        
        # Add metadata
        entry['id'] = str(uuid.uuid4())
        entry['url'] = canonical_url
        entry['status'] = 'active'
        entry['firstSeen'] = datetime.now(timezone.utc).isoformat()
        entry['lastSeen'] = datetime.now(timezone.utc).isoformat()
        entry['sourceUnavailable'] = False
        
        # Calculate content checksum
        content_for_checksum = json.dumps(entry, sort_keys=True)
        checksum = self.calculate_checksum(content_for_checksum)
        
        # Add provenance
        entry['provenance'] = self.generate_provenance(canonical_url)
        entry['provenance']['checksum'] = checksum
        
        # Calculate quality scores
        entry['qualityScores'] = self.quality_scorer.calculate_scores(entry)
        
        self.logger.info(f"Extracted entry with IQS: {entry['qualityScores']['iqs']}, "
                        f"AIS: {entry['qualityScores']['ais']}")

        self.url_registry.persist()
        
        return [entry]
    
    def extract_benefit_entry(self, soup: BeautifulSoup) -> Optional[Dict[str, Any]]:
        """
        Extract benefit information from parsed HTML
        
        Args:
            soup: BeautifulSoup object
            
        Returns:
            Benefit entry dictionary
        """
        entry = {}

        try:
            # Always extract head <title> and <meta name='description'>
            head_title = self._extract_head_title(soup)
            head_desc = self._extract_meta_tag(soup, ['description', 'og:description', 'twitter:description'])
            entry['head'] = {'title': head_title, 'description': head_desc}

            # Use meta title/description as main title/summary if present
            main_title = self._get_best_title(soup, seed_name='benefits', url=self.TARGET_URL)
            if main_title:
                entry['title'] = main_title

            main_summary = head_desc if head_desc else self._extract_summary(soup)
            if main_summary:
                entry['summary'] = {'de': main_summary}

            # Extract main content
            content = self._extract_content(soup)
            if content:
                entry['content'] = {'de': content}

            # Extract benefit amount
            benefit_amount = self._extract_benefit_amount(soup)
            if benefit_amount:
                entry['benefitAmount'] = {'de': benefit_amount}

            # Extract eligibility criteria
            eligibility = self._extract_eligibility(soup)
            if eligibility:
                entry['eligibilityCriteria'] = {'de': eligibility}

            # Extract application steps
            application_steps = self._extract_application_steps(soup)
            if application_steps:
                entry['applicationSteps'] = [{'de': step} for step in application_steps]

            # Extract required documents
            required_docs = self._extract_required_documents(soup)
            if required_docs:
                entry['requiredDocuments'] = [{'de': doc} for doc in required_docs]

            # Extract topics and tags
            entry['topics'] = ['benefits', 'unemployment', 'buergergeld']
            entry['tags'] = ['arbeitslosengeld', 'grundsicherung', 'sozialleistungen']
            entry['targetGroups'] = ['arbeitslose', 'geringverdiener', 'alleinerziehende']

        except Exception as e:
            self.logger.error(f"Error extracting benefit entry: {e}")
            return None

        return entry if entry else None
    
    def _extract_title(self, soup: BeautifulSoup) -> str:
        """Extract page title but avoid navigation/menu H1s like 'Navigation' or 'Hauptnavigation'"""
        def is_nav_like(element: BeautifulSoup) -> bool:
            if not element:
                return False
            for parent in element.parents:
                if parent.name in ('nav', 'header', 'footer', 'aside'):
                    return True
                cls = ' '.join(parent.get('class', [])).lower() if parent.get('class') else ''
                pid = (parent.get('id') or '').lower()
                if any(tok in cls for tok in ('nav', 'navigation', 'menu', 'hauptnavigation', 'breadcrumb')):
                    return True
                if any(tok in pid for tok in ('nav', 'navigation', 'menu', 'hauptnavigation', 'breadcrumb')):
                    return True
            return False

        # Prefer H1 if it's not navigation/menu text
        if soup:
            h1 = soup.find('h1')
            if h1 and not is_nav_like(h1):
                text = self.extract_text(h1)
                if text and text.strip().lower() not in ('navigation', 'hauptnavigation', 'haupt-navigation'):
                    return text

        # Fallback to head <title>
        title_tag = soup.find('title') if soup else None
        if title_tag:
            return self.extract_text(title_tag)

        # Fallback: use a sensible default
        return "Bürgergeld (Arbeitslosengeld II)"

    def _extract_head_title(self, soup: BeautifulSoup) -> str:
        if not soup:
            return ''
        title_tag = soup.find('title')
        if title_tag:
            return self.extract_text(title_tag)
        # Try common meta properties
        for meta in soup.find_all('meta'):
            name = (meta.get('name') or meta.get('property') or '').lower()
            if name in ('og:title', 'twitter:title'):
                return (meta.get('content') or '').strip()
        return ''
    
    def _extract_summary(self, soup: BeautifulSoup) -> str:
        """Extract summary/introduction"""
        return self._extract_best_summary(soup)
    
    def _extract_content(self, soup: BeautifulSoup) -> str:
        """Extract main content"""
        return self._extract_best_content(soup, summary=self._extract_summary(soup), max_parts=6)
    
    def _extract_benefit_amount(self, soup: BeautifulSoup) -> str:
        """Extract benefit amount information"""
        keywords = ['regelbedarf', 'regelsatz', 'höhe', 'betrag', 'euro']
        # Try section-based extraction first
        for keyword in keywords:
            sections = soup.find_all(['h2', 'h3', 'h4'])
            for section in sections:
                section_text = self.extract_text(section).lower()
                if keyword in section_text:
                    amount_text = []
                    for sibling in section.find_next_siblings():
                        if sibling.name in ['h2', 'h3', 'h4']:
                            break
                        if sibling.name == 'p':
                            amount_text.append(self.extract_text(sibling))
                    if amount_text:
                        return ' '.join(amount_text)
        # Fallback: search all paragraphs for keywords
        for p in soup.find_all('p'):
            text = self.extract_text(p)
            if any(k in text.lower() for k in keywords):
                return text
        # Fallback: try summary or content
        summary = self._extract_summary(soup)
        if any(k in summary.lower() for k in keywords):
            return summary
        content = self._extract_content(soup)
        if any(k in content.lower() for k in keywords):
            return content
        return ""
    
    def _extract_eligibility(self, soup: BeautifulSoup) -> str:
        """Extract eligibility criteria"""
        keywords = ['voraussetzung', 'anspruch', 'berechtigt', 'bedingung']
        # Try section-based extraction first
        for keyword in keywords:
            sections = soup.find_all(['h2', 'h3', 'h4'])
            for section in sections:
                section_text = self.extract_text(section).lower()
                if keyword in section_text:
                    eligibility_text = []
                    for sibling in section.find_next_siblings():
                        if sibling.name in ['h2', 'h3', 'h4']:
                            break
                        if sibling.name in ['p', 'ul', 'ol']:
                            eligibility_text.append(self.extract_text(sibling))
                    if eligibility_text:
                        return ' '.join(eligibility_text)
        # Fallback: search all paragraphs for keywords
        for p in soup.find_all('p'):
            text = self.extract_text(p)
            if any(k in text.lower() for k in keywords):
                return text
        # Fallback: try summary or content
        summary = self._extract_summary(soup)
        if any(k in summary.lower() for k in keywords):
            return summary
        content = self._extract_content(soup)
        if any(k in content.lower() for k in keywords):
            return content
        return ""
    
    def _extract_application_steps(self, soup: BeautifulSoup) -> List[str]:
        """Extract application steps"""
        keywords = ['antrag', 'beantragen', 'anleitung', 'schritt']
        
        for keyword in keywords:
            sections = soup.find_all(['h2', 'h3', 'h4'])
            for section in sections:
                section_text = self.extract_text(section).lower()
                if keyword in section_text:
                    # Look for ordered or unordered lists
                    list_element = section.find_next(['ol', 'ul'])
                    if list_element:
                        steps = [self.extract_text(li) for li in list_element.find_all('li')]
                        return [step for step in steps if step]
        
        return []
    
    def _extract_required_documents(self, soup: BeautifulSoup) -> List[str]:
        """Extract required documents"""
        keywords = ['unterlagen', 'dokument', 'nachweis', 'erforderlich']
        
        for keyword in keywords:
            sections = soup.find_all(['h2', 'h3', 'h4'])
            for section in sections:
                section_text = self.extract_text(section).lower()
                if keyword in section_text:
                    list_element = section.find_next(['ul', 'ol'])
                    if list_element:
                        docs = [self.extract_text(li) for li in list_element.find_all('li')]
                        return [doc for doc in docs if doc]
        
        return []
    
    def save_candidates(self, entries: List[Dict[str, Any]], output_path: str):
        """
        Save candidate entries to JSON file
        
        Args:
            entries: List of candidate entries
            output_path: Path to output file
        """
        output_dir = Path(output_path).parent
        output_dir.mkdir(parents=True, exist_ok=True)
        
        output_data = {
            'version': '0.1.0',
            'domain': 'benefits',
            'crawlDate': datetime.now(timezone.utc).isoformat(),
            'source': 'arbeitsagentur',
            'entries': entries
        }
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, indent=2, ensure_ascii=False)
        
        self.logger.info(f"Saved {len(entries)} candidate entries to {output_path}")
