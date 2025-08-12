from core.base import Crawler, register
from core.sitemap import robots_sitemaps, parse_sitemap, head_preflight
from core.extract import get_html, extract_main

@register
class GenericSitemap(Crawler):
    name = "generic"

    def discover(self):
        base = self.cfg["domain"].rstrip("/")
        allow = self.cfg.get("allow_paths", ["/"])
        exclude = set(self.cfg.get("exclude_paths", []))
        max_urls = int(self.cfg.get("max_urls", self.default_max))
        smaps = self.cfg.get("sitemap_overrides") or robots_sitemaps(base) or [f"{base}/sitemap.xml"]
        urls = []
        for sm in smaps:
            urls.extend(parse_sitemap(sm))
        seen, out = set(), []
        for u in urls:
            if not any(u.startswith(f"{base}{p}") for p in allow): continue
            if any(u.startswith(f"{base}{p}") for p in exclude):   continue
            k = u.rstrip("/")
            if k in seen: continue
            seen.add(k); out.append(u)
            if len(out) >= max_urls: break
        for u in out:
            yield type("CrawlItem", (), {"url": u, "source": self.name})()

    def fetch_one(self, item):
        ok, status = head_preflight(item.url)
        if not ok:
            return self.normalize({"url": item.url, "status": status})
        soup = get_html(item.url)
        if not soup:
            return self.normalize({"url": item.url, "status": "error"})
        data = extract_main(soup)
        h1 = soup.find("h1")
        p = soup.find("p")
        return self.normalize({
            "url": item.url,
            "title": data.get("title"),
            "meta_description": data.get("meta_description"),
            "h1": h1.get_text(strip=True) if h1 else None,
            "excerpt": (p.get_text(" ", strip=True)[:400] if p else None),
            "content": data.get("content"),
        })
