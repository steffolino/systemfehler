import json, os
from urllib.parse import urljoin
from utils import (
    get_sitemaps_from_robots, parse_sitemap, filter_urls, head_ok,
    fetch_info_page, save_data
)

DOMAINS_FILE = "domains.json"
OUTFILE = "../api/data/benefits.json"

def load_domains():
    with open(DOMAINS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

if __name__ == "__main__":
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
            # fallback to /sitemap.xml
            sitemaps = [urljoin(base, "/sitemap.xml")]

        all_urls = []
        for sm in sitemaps:
            print(f"  • reading {sm}")
            all_urls += parse_sitemap(sm)

        filtered = filter_urls(all_urls, base, allow_paths, d.get("exclude_paths", []))[:max_urls]
        print(f"  → {len(filtered)} URLs after filtering")
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
                    "url": url, "title": None, "meta_description": None,
                    "h1": None, "excerpt": None, "content": None,
                    "topic": None, "source": base, "language": ["de"],
                    "status": status
                })
                continue

            data = fetch_info_page(url) or {}
            # enrich with minimal context
            data["topic"] = data.get("topic") or None
            data["source"] = data.get("source") or base
            data["language"] = data.get("language") or ["de"]
            if "status" not in data:
                data["status"] = "ok"
            results.append(data)

    os.makedirs(os.path.dirname(OUTFILE), exist_ok=True)
    save_data(OUTFILE, results)
    print(f"✅ Saved {len(results)} records to {OUTFILE}")
