from .base_service import BaseService
import requests
from bs4 import BeautifulSoup

class CrawlerService(BaseService):
    def __init__(self, **config):
        super().__init__(**config)
        self.visited = set()

    def configure(self, **config):
        super().configure(**config)

    def crawl(self, start_url, max_depth=1):
        self.visited.clear()
        self._crawl_url(start_url, max_depth, 0)

    def _crawl_url(self, url, max_depth, current_depth):
        if current_depth > max_depth or url in self.visited:
            return
        self.visited.add(url)
        try:
            resp = requests.get(url, timeout=5)
            if resp.status_code != 200:
                return
            soup = BeautifulSoup(resp.text, 'html.parser')
            links = [a['href'] for a in soup.find_all('a', href=True)]
            for link in links:
                if link.startswith('http'):
                    self._crawl_url(link, max_depth, current_depth + 1)
        except Exception:
            pass  # Optionally log errors
