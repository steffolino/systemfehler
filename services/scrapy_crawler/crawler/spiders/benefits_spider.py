import scrapy

class BenefitsSpider(scrapy.Spider):
    name = "benefits"
    category = "service"
    custom_settings = {
        'LOG_LEVEL': 'INFO',
    }

    def start_requests(self):
        import os, json
        sources_path = os.path.join(os.path.dirname(__file__), '../../systemfehler/sources/service.json')
        with open(sources_path, encoding='utf-8') as f:
            sources = json.load(f)
        for src in sources['sources']:
            for url in src.get('seed_urls', []):
                    yield scrapy.Request(url, callback=self.parse, meta={'domain': src['domain'], 'keywords': src.get('keywords', [])})
    def parse(self, response):
        try:
            page_content = response.text
            title = None
            # Try to extract title from <h1> or <title>
            import re
            m = re.search(r'<h1[^>]*>(.*?)</h1>', page_content, re.I)
            if m:
                title = m.group(1).strip()
            else:
                m = re.search(r'<title>(.*?)</title>', page_content, re.I)
                if m:
                    title = m.group(1).strip()
            # Extract keywords
            words = re.findall(r'\b\w{4,}\b', page_content.lower())
            freq = {}
            for w in words:
                freq[w] = freq.get(w, 0) + 1
            keywords = ','.join(sorted(freq, key=freq.get, reverse=True)[:10])
            # Compose staging_entry
            yield {
                'id': response.url,
                'category': self.category,
                'source_url': response.url,
                'source_domain': response.meta.get('domain', ''),
                'title': title or response.meta.get('domain', ''),
                'summary': ', '.join(response.meta.get('keywords', [])),
                'language': 'de',
                'topic': ','.join(response.meta.get('keywords', [])),
                'content': page_content,
                'keywords': keywords,
                'payload': '',
                'first_seen': '',
                'last_seen': '',
                'checksum': ''
            }
        except Exception as e:
            self.logger.error(f"Error parsing {response.url}: {e}", exc_info=True)
