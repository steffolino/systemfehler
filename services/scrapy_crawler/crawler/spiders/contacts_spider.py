import scrapy
import json
import re

class ContactsSpider(scrapy.Spider):
    name = "contacts"
    custom_settings = {
        'FEEDS': {
            '../../data/contacts/entries.json': {
                'format': 'json',
                'overwrite': True
            }
        },
        'LOG_LEVEL': 'INFO',
    }

    def start_requests(self):
        with open('../../data/sources/contacts.json', encoding='utf-8') as f:
            config = json.load(f)
        for domain in config.get('domains', []):
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
        emails_std = re.findall(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+', page_content)
        emails_alt = re.findall(r'[a-zA-Z0-9_.+-]+\(at\)[a-zA-Z0-9-]+\(dot\)[a-zA-Z0-9-.]+', page_content)
        emails_alt = [e.replace('(at)', '@').replace('(dot)', '.') for e in emails_alt]
        emails = emails_std + emails_alt
        # Stricter phone regex: matches numbers with country/area code, at least 8 digits, allows spaces, dashes, parentheses
        # Phone extraction disabled for now
        phones = None
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

        obj = {
            'id': safe(response.meta['domain'], None),
            'title_de': safe(name or response.meta['domain'].split('.')[0].capitalize(), None),
            'title_en': None,
            'summary_de': safe(', '.join(response.meta.get('keywords', [])), None),
            'summary_en': None,
            'url': safe(response.url, None),
            'category': None,
            'language': ['de'],
            'topic': safe(response.meta.get('keywords', []), None),
            'createdAt': safe(response.headers.get('Date', b'').decode() or None, None),
            'updatedAt': safe(response.headers.get('Date', b'').decode() or None, None),
            'content': safe(page_content, None),
            'emails': safe(emails, None),
            # 'phones': safe(phones, None),
            'addresses': safe(addresses, None),
            'social_media': safe(social_media, None),
            'tags': safe(keywords, None)
        }
        # Only yield if all required fields are present and valid
        required = ['id', 'title_de', 'url']
        if all(obj.get(k) not in (None, '', [], {}) for k in required):
            yield obj
