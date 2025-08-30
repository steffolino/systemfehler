import json, os
from urllib.parse import urljoin
from utils import (
    get_sitemaps_from_robots, parse_sitemap, filter_urls, head_ok,
    fetch_info_page, save_data
)
import requests
from bs4 import BeautifulSoup
import xml.etree.ElementTree as ET
import uuid
from datetime import datetime

DOMAINS_FILE = "domains.json"
OUTFILE = "../api/data/benefits.json"

with open("sources.json") as f:
    SOURCES = json.load(f)

def load_domains():
    with open(DOMAINS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def get_urls_from_sitemap(sitemap_url):
    resp = requests.get(sitemap_url, timeout=10)
    resp.raise_for_status()
    urls = []
    tree = ET.fromstring(resp.content)
    for url in tree.findall(".//{http://www.sitemaps.org/schemas/sitemap/0.9}url"):
        loc = url.find("{http://www.sitemaps.org/schemas/sitemap/0.9}loc")
        if loc is not None and loc.text:
            urls.append(loc.text)
    return urls

SITEMAP_URLS = [
    "https://www.arbeitsagentur.de/sitemap.xml",
    # Add more sitemap URLs here
]

def get_all_crawl_sources():
    sources = []
    for sitemap_url in SITEMAP_URLS:
        try:
            sources.extend(get_urls_from_sitemap(sitemap_url))
        except Exception as e:
            print(f"Failed to fetch sitemap {sitemap_url}: {e}")
    # Optionally, add static/manual URLs as fallback:
    # sources.extend([...])
    return sources

if __name__ == "__main__":
    # Use encoding='utf-8' for stdout to support Unicode (emojis)
    import sys
    if sys.stdout.encoding.lower() != "utf-8":
        sys.stdout.reconfigure(encoding="utf-8")

    domains = load_domains()
    results = []

    for d in domains:
        base = d["domain"].rstrip("/")
        allow_paths = d.get("allow_paths", [])
        overrides = d.get("sitemap_overrides", []) or []
        max_urls = int(d.get("max_urls", 50))

        print(f"🔎 Discovering sitemaps for {base}")
        sitemaps = overrides or get_sitemaps_from_robots(base)
        if not sitemaps:
            sitemaps = [urljoin(base, "/sitemap.xml")]

        all_urls = []
        for sm in sitemaps:
            print(f"  • reading {sm}")
            all_urls += parse_sitemap(sm)

        filtered = filter_urls(all_urls, base, allow_paths, d.get("exclude_paths", []))[:max_urls]
        print(f"  → {len(filtered)} URLs after filtering")
        if not filtered:
            sample = [u['loc'] for u in all_urls[:5]]
            print("    (No matches) Example URLs from sitemap:", *sample, sep="\n    • ")

        for i, u in enumerate(filtered, start=1):
            url = u["loc"]
            print(f"📥 [{i}/{len(filtered)}] {url}")
            ok, status = head_ok(url)
            if not ok:
                results.append({
                    "id": str(uuid.uuid4()),
                    "url": url, "title": None, "meta_description": None,
                    "h1": None, "excerpt": None, "content": None,
                    "topic": [],  # ensure topic is always an array
                    "source": base, "language": ["de"],
                    "status": status,
                    "last_crawled_at": datetime.utcnow().isoformat() + "Z"
                })
                continue

            data = fetch_info_page(url) or {}
            # ensure topic is always an array
            topic = data.get("topic")
            if topic is None:
                data["topic"] = []
            elif not isinstance(topic, list):
                data["topic"] = [topic]
            data["source"] = data.get("source") or base
            data["language"] = data.get("language") or ["de"]
            if "status" not in data:
                data["status"] = "ok"
            if "id" not in data or not data["id"]:
                data["id"] = str(uuid.uuid4())
            if "last_crawled_at" not in data or not data["last_crawled_at"]:
                data["last_crawled_at"] = datetime.utcnow().isoformat() + "Z"
            results.append(data)

    for url in SOURCES:
        print(f"📥 Crawling source URL: {url}")
        ok, status = head_ok(url)
        if not ok:
            results.append({
                "id": str(uuid.uuid4()),
                "url": url, "title": None, "meta_description": None,
                "h1": None, "excerpt": None, "content": None,
                "topic": [],  # ensure topic is always an array
                "source": url, "language": ["de"],
                "status": status,
                "last_crawled_at": datetime.utcnow().isoformat() + "Z"
            })
            continue

        data = fetch_info_page(url) or {}
        # ensure topic is always an array
        topic = data.get("topic")
        if topic is None:
            data["topic"] = []
        elif not isinstance(topic, list):
            data["topic"] = [topic]
        data["source"] = data.get("source") or url
        data["language"] = data.get("language") or ["de"]
        if "status" not in data:
            data["status"] = "ok"
        if "id" not in data or not data["id"]:
            data["id"] = str(uuid.uuid4())
        if "last_crawled_at" not in data or not data["last_crawled_at"]:
            data["last_crawled_at"] = datetime.utcnow().isoformat() + "Z"
        results.append(data)

    os.makedirs(os.path.dirname(OUTFILE), exist_ok=True)
    save_data(OUTFILE, results)
    print(f"✅ Saved {len(results)} records to {OUTFILE}")

    # Remove duplicate crawl logic for get_all_crawl_sources()
    # If you want to crawl all URLs from sitemaps, integrate above.
    # ...existing code...
