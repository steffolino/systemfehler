import scrapy
from systemfehler.items import StagingEntryItem
import hashlib
import json
from datetime import datetime

class GenericSiteSpider(scrapy.Spider):
    name = 'generic_site'
    def __init__(self, source=None, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.source = source
        if source:
            with open(f'systemfehler/sources/{source}', encoding='utf-8') as f:
                self.sources = json.load(f)
        else:
            self.sources = []
    def start_requests(self):
        for src in self.sources:
            for url in src['seed_urls']:
                yield scrapy.Request(
                    url,
                    meta={'src': src},
                    errback=self.errback_httpbin,
                    dont_filter=True
                )

    def errback_httpbin(self, failure):
        self.logger.error(repr(failure))
        request = failure.request
        src = request.meta.get('src', {})
        # Optionally: yield a minimal error item for failed requests
        item = StagingEntryItem()
        item['url'] = request.url
        item['source_url'] = request.url
        item['source_domain'] = src.get('domain')
        item['fetched_at'] = datetime.utcnow().isoformat()
        item['lang'] = src.get('lang', 'de')
        item['language'] = src.get('lang', 'de')
        item['title'] = None
        item['summary'] = f"ERROR: {repr(failure)}"
        item['content'] = ''
        item['topic'] = src.get('topic')
        item['keywords'] = json.dumps(src.get('keywords', []), ensure_ascii=False)
        item['category'] = src.get('category')
        item['raw_json'] = '{}'
        now = datetime.utcnow().isoformat()
        item['first_seen'] = now
        item['last_seen'] = now
        payload = {
            'url': item['url'],
            'source_domain': item['source_domain'],
            'title': item['title'],
            'summary': item['summary'],
            'content': item['content'],
            'topic': item['topic'],
            'keywords': item['keywords'],
            'category': item['category'],
            'lang': item['lang'],
            'language': item['language'],
        }
        item['payload'] = json.dumps(payload, ensure_ascii=False)
        item['id'] = hashlib.sha256((item['source_domain'] + '|' + item['source_url']).encode('utf-8')).hexdigest()
        item['checksum'] = hashlib.sha256(item['payload'].encode('utf-8')).hexdigest()
        yield item
    def parse(self, response):
        src = response.meta['src']
        item = StagingEntryItem()
        # Grunddaten
        item['url'] = response.url
        item['source_url'] = response.url
        item['source_domain'] = src.get('domain')
        item['fetched_at'] = datetime.utcnow().isoformat()
        item['lang'] = src.get('lang', 'de')
        item['language'] = src.get('lang', 'de')
        item['title'] = response.xpath('//title/text()').get()
        item['summary'] = ''
        item['content'] = response.text[:1000]
        item['topic'] = src.get('topic')
        item['keywords'] = json.dumps(src.get('keywords', []), ensure_ascii=False)
        item['category'] = src.get('category')
        # Convert header keys and values to str for JSON serialization
        headers_str = {str(k, 'utf-8') if isinstance(k, bytes) else str(k): str(v, 'utf-8') if isinstance(v, bytes) else str(v) for k, v in response.headers.items()}
        item['raw_json'] = json.dumps({'headers': headers_str}, ensure_ascii=False)
        # Zeitstempel
        now = datetime.utcnow().isoformat()
        item['first_seen'] = now
        item['last_seen'] = now
        # Payload und Checksumme
        payload = {
            'url': item['url'],
            'source_domain': item['source_domain'],
            'title': item['title'],
            'summary': item['summary'],
            'content': item['content'],
            'topic': item['topic'],
            'keywords': item['keywords'],
            'category': item['category'],
            'lang': item['lang'],
            'language': item['language'],
        }
        item['payload'] = json.dumps(payload, ensure_ascii=False)
        item['id'] = hashlib.sha256((item['source_domain'] + '|' + item['source_url']).encode('utf-8')).hexdigest()
        item['checksum'] = hashlib.sha256(item['payload'].encode('utf-8')).hexdigest()
        yield item
