# services/crawler/plugins/arbeitsagentur/plugin.py
from core.base import Crawler, CrawlItem, register
from core.sitemap import robots_sitemaps, parse_sitemap, head_preflight
from core.extract import get_html, extract_main

@register
class Arbeitsagentur(Crawler):
    name = "arbeitsagentur"

    def discover(self):
        base = self.cfg.get("domain", "https://www.arbeitsagentur.de").rstrip("/")
        allow = self.cfg.get("allow_paths", ["/buergergeld", "/familie-und-kinder", "/jobcenter"])
        exclude = set(self.cfg.get("exclude_paths", ["/vor-ort", "/int", "/presse"]))
        max_urls = int(self.cfg.get("max_urls", self.default_max))

        smaps = self.cfg.get("sitemap_overrides") or robots_sitemaps(base) or [f"{base}/sitemap-portal.xml"]
        urls: list[str] = []
        for sm in smaps:
            urls.extend(parse_sitemap(sm))
        # filter
        seen, out = set(), []
        for u in urls:
            if any(u.startswith(f"{base}{p}") for p in allow) and not any(u.startswith(f"{base}{p}") for p in exclude):
                k = u.rstrip("/")
                if k in seen: continue
                seen.add(k)
                out.append(u)
            if len(out) >= max_urls: break
        for u in out:
            yield CrawlItem(url=u, source=self.name)

    def fetch_one(self, item: CrawlItem):
        ok, status = head_preflight(item.url)
        if not ok:
            return self.normalize({
                "url": item.url, "status": status,
                "title": None, "meta_description": None, "h1": None, "excerpt": None, "content": None
            })
        soup = get_html(item.url)
        if not soup:
            return self.normalize({"url": item.url, "status": "error"})
        data = extract_main(soup)
        h1 = soup.find("h1")
        excerpt = None
        p = soup.find("p")
        if p: excerpt = " ".join(p.get_text(" ", strip=True).split())[:400]
        return self.normalize({
            "url": item.url,
            "title": data["title"],
            "meta_description": data["meta_description"],
            "h1": h1.get_text(strip=True) if h1 else None,
            "excerpt": excerpt,
            "content": data["content"],
            "topic": None,
        })
