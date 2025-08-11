import requests, gzip, io, re, os, json
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
from xml.etree import ElementTree as ET
from urllib.parse import urlparse

def get_sitemaps_from_robots(base: str) -> list[str]:
    """Read robots.txt and extract Sitemap: lines."""
    robots_url = urljoin(base, "/robots.txt")
    try:
        res = requests.get(robots_url, timeout=10)
        res.raise_for_status()
    except Exception:
        return []
    sitemaps = []
    for line in res.text.splitlines():
        if line.lower().startswith("sitemap:"):
            sitemaps.append(line.split(":", 1)[1].strip())
    return sitemaps

def _fetch_xml(url: str) -> bytes | None:
    headers = {"User-Agent": "SystemfehlerCrawler/0.1 (+https://example.org)"}
    res = requests.get(url, headers=headers, timeout=20, allow_redirects=True)
    res.raise_for_status()
    content = res.content
    # handle .gz transparently
    if url.endswith(".gz") or res.headers.get("Content-Type","").endswith("gzip"):
        try:
            content = gzip.decompress(content)
        except Exception:
            # some servers mislabel; try stream
            content = gzip.GzipFile(fileobj=io.BytesIO(res.content)).read()
    return content

def parse_sitemap(url: str) -> list[dict]:
    """
    Returns a flat list of {'loc':..., 'lastmod':...} from either a sitemap index or a urlset.
    Recurses indexes.
    """
    try:
        xml_bytes = _fetch_xml(url)
        if not xml_bytes: return []
        root = ET.fromstring(xml_bytes)

        # namespace agnostic
        def tag(x): 
            return x.split("}")[-1] if "}" in x else x

        if tag(root.tag) == "sitemapindex":
            urls = []
            for sm in root.findall(".//"):
                if tag(sm.tag) == "loc":
                    child = sm.text.strip()
                    urls += parse_sitemap(child)
            return urls

        if tag(root.tag) == "urlset":
            urls = []
            for u in root.findall(".//"):
                if tag(u.tag) == "url":
                    loc = None; lastmod = None
                    for c in list(u):
                        t = tag(c.tag)
                        if t == "loc": loc = (c.text or "").strip()
                        elif t == "lastmod": lastmod = (c.text or "").strip()
                    if loc:
                        urls.append({"loc": loc, "lastmod": lastmod})
            return urls

        return []
    except Exception as e:
        print(f"⚠️ sitemap parse failed {url}: {e}")
        return []


def filter_urls(urls: list[dict], base: str, allow_paths: list[str], exclude_paths: list[str] | None = None) -> list[dict]:
    exclude_paths = exclude_paths or []
    base_netloc = urlparse(base).netloc
    out, seen = [], set()
    for item in urls:
        loc = (item.get("loc") or "").split("#")[0]
        if not loc:
            continue
        p = urlparse(loc)
        if p.netloc != base_netloc:
            continue
        if any(p.path.startswith(x) for x in exclude_paths):
            continue
        if allow_paths and not any(p.path.startswith(ap) for ap in allow_paths):
            continue
        if p.path.lower().endswith((".pdf",".jpg",".jpeg",".png",".gif",".webp",".svg")):
            continue
        key = loc.rstrip("/")
        if key in seen:
            continue
        seen.add(key)
        out.append(item)
    return out


def head_ok(url: str) -> tuple[bool, str | None]:
    try:
        r = requests.head(url, timeout=10, allow_redirects=True,
                          headers={"User-Agent": "SystemfehlerCrawler/0.1"})
        if r.status_code in (404, 410): return (False, "not_found")
        if r.status_code in (405, 403): return (True, None)   # allow GET
        if 500 <= r.status_code < 600: return (False, "error")
        return (True, None)
    except Exception:
        return (False, "error")



def fetch_info_page(url: str):
    """Fetch page metadata + main content + status code detection."""
    try:
        res = requests.get(url, timeout=15, allow_redirects=True)
        res.encoding = res.apparent_encoding or res.encoding

        res.raise_for_status()
        soup = BeautifulSoup(res.text, 'html.parser')

        title = soup.title.string.strip() if soup.title else None
        meta_desc = _get_meta_description(soup)
        h1 = soup.find('h1')
        excerpt = _first_paragraph_excerpt(soup)
        main_content = _extract_main_content(soup)

        # Detect deleted/404
        is_404 = _detect_not_found(soup, res.status_code, url)
        status = "not_found" if is_404 else "ok"

        return {
            "url": url,
            "title": title,
            "meta_description": meta_desc,
            "h1": h1.get_text(strip=True) if h1 else None,
            "excerpt": excerpt,
            "content": main_content,
            "status": status
        }
    except Exception as e:
        print(f"⚠️ Error fetching {url}: {e}")
        return {
            "url": url,
            "title": None,
            "meta_description": None,
            "h1": None,
            "excerpt": None,
            "content": None,
            "status": "error"
        }

def _get_meta_description(soup):
    tag = soup.find("meta", attrs={"name": "description"})
    if tag and "content" in tag.attrs:
        return tag["content"].strip()
    og = soup.find("meta", attrs={"property": "og:description"})
    return og["content"].strip() if og and "content" in og.attrs else None

def _first_paragraph_excerpt(soup, max_len=400):
    p = soup.find('p')
    if not p:
        return None
    text = p.get_text(" ", strip=True)
    return text[:max_len] + ("…" if len(text) > max_len else "")

def _extract_main_content(soup):
    """Try to extract main readable content."""
    # Priority: <main>, then common CMS wrappers
    main_tag = soup.find('main')
    if main_tag:
        return _clean_text(main_tag.get_text(" ", strip=True))
    article_tag = soup.find('article')
    if article_tag:
        return _clean_text(article_tag.get_text(" ", strip=True))
    content_div = soup.find('div', class_=['content', 'main-content'])
    if content_div:
        return _clean_text(content_div.get_text(" ", strip=True))
    return None

def _clean_text(text):
    return " ".join(text.split())

def _detect_not_found(soup, status_code, url):
    """Return True if HTTP status or text indicates a missing/deleted page."""
    if status_code == 404:
        return True
    text = soup.get_text(" ", strip=True).lower()
    not_found_keywords = [
        "seite nicht gefunden", "404", "diese seite existiert nicht",
        "nicht mehr verfügbar", "gelöscht", "nicht gefunden"
    ]
    return any(k in text for k in not_found_keywords)

def save_data(filename, data):
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
