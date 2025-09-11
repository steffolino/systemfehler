import scrapy
import json
import re

class MetaSpider(scrapy.Spider):
    name = "meta"
    custom_settings = {
        'FEED_FORMAT': 'json',
        'FEED_URI': '../../data/meta/tools.json',
        'LOG_LEVEL': 'INFO',
    }

    def start_requests(self):
        with open('../../data/sources/meta.json', encoding='utf-8') as f:
            config = json.load(f)
        for domain in config.get('sources', []):
            for url in domain.get('seed_urls', []):
                yield scrapy.Request(url, meta={'domain': domain['domain'], 'keywords': domain.get('keywords', [])})

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
        def safe(val, fallback=None):
            if val is None or val == '' or val == [] or val == {}:
                return None
            if isinstance(val, str):
                # Replace unicode escapes with actual characters
                return val.encode('utf-8', errors='replace').decode('unicode_escape')
            if isinstance(val, list):
                return [safe(v, fallback) for v in val if v not in (None, '', [], {})] or None
            return val

        yield {
            'id': safe(response.meta['domain'], ''),
            'title_de': safe(name or response.meta['domain'].split('.')[0].capitalize(), ''),
            'title_en': None,
            'summary_de': safe(', '.join(response.meta.get('keywords', [])), ''),
            'summary_en': None,
            'url': safe(response.url, ''),
            'category': None,
            'language': ['de'],
            'topic': safe(response.meta.get('keywords', []), []),
            'createdAt': safe(response.headers.get('Date', b'').decode() or None, None),
            'updatedAt': safe(response.headers.get('Date', b'').decode() or None, None),
            'content': safe(page_content, ''),
            'emails': safe(emails, []),
            'phones': safe(phones, []),
            'addresses': safe(addresses, []),
            'social_media': safe(social_media, []),
            'tags': safe(keywords, [])
        }
