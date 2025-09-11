import scrapy
import json
import re

class AidSpider(scrapy.Spider):
    name = "aid"
    custom_settings = {
        'FEEDS': {
            '../../data/aid/entries.json': {
                'format': 'json',
                'overwrite': True
            }
        },
        'LOG_LEVEL': 'INFO',
    }

    def start_requests(self):
        # Generate mock aid data for testing
        self.logger.info("Generating mock aid data for testing")
        
        mock_aids = [
            {
                'domain': 'jobcenter.de',
                'title': 'Jobcenter - Unemployment Benefits',
                'content': 'Das Jobcenter unterstützt Menschen bei der Suche nach Arbeit und gewährt finanzielle Hilfen.',
                'keywords': ['unemployment', 'job search', 'benefits', 'support'],
                'emails': ['service@jobcenter.de'],
                'phones': ['0800-4555500'],
                'addresses': ['Jobcenter, verschiedene Standorte'],
                'social_media': []
            },
            {
                'domain': 'arbeitsagentur.de', 
                'title': 'Arbeitsagentur - Employment Agency',
                'content': 'Die Bundesagentur für Arbeit vermittelt Arbeitsplätze und zahlt Arbeitslosengeld.',
                'keywords': ['employment', 'job placement', 'unemployment insurance'],
                'emails': ['service@arbeitsagentur.de'],
                'phones': ['0800-4555521'],
                'addresses': ['Bundesagentur für Arbeit, Nürnberg'],
                'social_media': ['https://twitter.com/bundesagentur']
            }
        ]
        
        for mock_data in mock_aids:
            yield self.generate_mock_item(mock_data)
    
    def generate_mock_item(self, mock_data):
        """Generate a structured item from mock data"""
        return {
            'kind': 'aid',
            'id': f"aid_{mock_data['domain']}",
            'title_de': mock_data['title'],
            'title_en': None,
            'summary_de': ', '.join(mock_data['keywords']),
            'summary_en': None,
            'url': f"https://{mock_data['domain']}",
            'category': 'employment',
            'language': ['de'],
            'topic': mock_data['keywords'],
            'createdAt': '2025-09-11T15:30:00Z',
            'updatedAt': '2025-09-11T15:30:00Z', 
            'content': mock_data['content'],
            'emails': mock_data['emails'],
            'phones': mock_data['phones'],
            'addresses': mock_data['addresses'],
            'social_media': mock_data['social_media'],
            'tags': mock_data['keywords']
        }

    def parse(self, response):
        page_content = response.text
        name = None
        m = re.search(r'<h1[^>]*>(.*?)</h1>', page_content, re.I)
        if m:
            name = m.group(1).strip()
        else:
            m = re.search(r'<title>(.*?)</title>', page_content, re.I)
            if m:
                name = m.group(1).strip()
        emails = re.findall(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+', page_content)
        phones = re.findall(r'(?:\+\d{1,3}[ \-]?)?(?:\(\d{1,5}\)[ \-]?)?\d{2,4}[ \-]?\d{2,4}[ \-]?\d{2,4}', page_content)
        addresses = re.findall(r'([A-ZÄÖÜa-zäöüß\-\. ]{3,}\s\d{1,4}[a-zA-Z]?\s*[,\n]\s*\d{5}\s+[A-ZÄÖÜa-zäöüß\-\. ]{2,})', page_content)
        social_media = re.findall(r'https?://(?:www\.)?(facebook|twitter|instagram|linkedin|youtube)\.com/[^\s\'\"<>]+', page_content)
        words = re.findall(r'\b\w{4,}\b', page_content.lower())
        freq = {}
        for w in words:
            freq[w] = freq.get(w, 0) + 1
        keywords = sorted(freq, key=freq.get, reverse=True)[:10]
        yield {
            'id': response.meta['domain'],
            'title_de': name or response.meta['domain'].split('.')[0].capitalize(),
            'title_en': None,
            'summary_de': ', '.join(response.meta.get('keywords', [])),
            'summary_en': None,
            'url': response.url,
            'category': None,
            'language': ['de'],
            'topic': response.meta.get('keywords', []),
            'createdAt': response.headers.get('Date', b'').decode() or None,
            'updatedAt': response.headers.get('Date', b'').decode() or None,
            'content': page_content,
            'emails': emails,
            'phones': phones,
            'addresses': addresses,
            'social_media': social_media,
            'tags': keywords
        }
