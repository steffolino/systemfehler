import json
import os
from scrapy.crawler import CrawlerProcess
from scrapy.utils.project import get_project_settings

# Path to master domains list
MASTER_DOMAINS_PATH = os.path.abspath("master_domains.json")

# Load master domains
with open(MASTER_DOMAINS_PATH, "r", encoding="utf-8") as f:
    domains = [entry["domain"] for entry in json.load(f) if entry.get("active")]

# List of spiders to run
spiders = [
    "aid_spider",
    "benefits_spider",
    "contacts_spider",
    "meta_spider",
    "tools_spider"
]

process = CrawlerProcess(get_project_settings())
for spider in spiders:
    process.crawl(spider, allowed_domains=domains)
process.start()
