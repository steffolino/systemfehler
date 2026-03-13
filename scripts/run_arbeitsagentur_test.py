import sys
import os
# Ensure project root is in sys.path for absolute imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from crawlers.benefits.arbeitsagentur_crawler import ArbeitsagenturCrawler

if __name__ == '__main__':
    crawler = ArbeitsagenturCrawler(user_agent='Systemfehler-Test/0.1')
    entries = crawler.crawl()
    print(f"Extracted {len(entries)} entries")
    if entries:
        import json
        print(json.dumps(entries[0], ensure_ascii=False, indent=2))
