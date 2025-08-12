# services/crawler/core/sitemap.py
import requests, gzip, io
from urllib.parse import urljoin, urlparse
from xml.etree import ElementTree as ET

UA = {"User-Agent": "SystemfehlerCrawler/0.1 (+https://systemfehler.local)"}

def robots_sitemaps(base: str) -> list[str]:
    try:
        r = requests.get(urljoin(base, "/robots.txt"), headers=UA, timeout=10)
        r.raise_for_status()
        return [ln.split(":",1)[1].strip() for ln in r.text.splitlines() if ln.lower().startswith("sitemap:")]
    except Exception:
        return []

def fetch_xml(url: str) -> bytes | None:
    r = requests.get(url, headers=UA, timeout=20, allow_redirects=True)
    r.raise_for_status()
    data = r.content
    if url.endswith(".gz") or r.headers.get("Content-Type","").endswith("gzip"):
        try:
            data = gzip.decompress(data)
        except Exception:
            data = gzip.GzipFile(fileobj=io.BytesIO(r.content)).read()
    return data

def parse_sitemap(url: str) -> list[str]:
    try:
        xml = fetch_xml(url)
        if not xml: return []
        root = ET.fromstring(xml)
        def tag(t): return t.split("}")[-1]
        if tag(root.tag) == "sitemapindex":
            locs = [el.text.strip() for el in root.findall(".//{*}loc")]
            out = []
            for loc in locs:
                out.extend(parse_sitemap(loc))
            return out
        if tag(root.tag) == "urlset":
            return [el.text.strip() for el in root.findall(".//{*}loc")]
        return []
    except Exception:
        return []

def head_preflight(url: str) -> tuple[bool, str | None]:
    try:
        r = requests.head(url, headers=UA, timeout=10, allow_redirects=True)
        if r.status_code in (404, 410): return (False, "not_found")
        if r.status_code in (405, 403): return (True, None)
        if 500 <= r.status_code < 600:  return (False, "error")
        return (True, None)
    except Exception:
        return (False, "error")
