import pytest
from services.crawler import CrawlerService

def test_crawler_configure():
    crawler = CrawlerService(foo='bar')
    assert crawler.config['foo'] == 'bar'
    crawler.configure(baz='qux')
    assert crawler.config['baz'] == 'qux'

def test_crawler_crawl(monkeypatch):
    crawler = CrawlerService()
    called = []

    def fake_get(url, timeout=5):
        class Resp:
            status_code = 200
            text = '<a href="http://example.com/next"></a>'
        called.append(url)
        return Resp()
    monkeypatch.setattr('requests.get', fake_get)
    crawler.crawl('http://example.com', max_depth=1)
    assert 'http://example.com' in crawler.visited
    assert 'http://example.com/next' in crawler.visited
