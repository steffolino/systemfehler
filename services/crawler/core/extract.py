# services/crawler/core/extract.py
import requests
from bs4 import BeautifulSoup

UA = {"User-Agent": "SystemfehlerCrawler/0.1 (+https://systemfehler.local)"}

def get_html(url: str) -> BeautifulSoup | None:
    r = requests.get(url, headers=UA, timeout=20, allow_redirects=True)
    r.encoding = r.apparent_encoding or r.encoding
    r.raise_for_status()
    return BeautifulSoup(r.text, "html.parser")

def extract_main(soup: BeautifulSoup) -> dict:
    def txt(n): return " ".join(n.get_text(" ", strip=True).split())
    title = soup.title.string.strip() if getattr(soup, "title", None) and soup.title.string else None
    meta = soup.find("meta", attrs={"name":"description"})
    og   = soup.find("meta", attrs={"property":"og:description"})
    meta_desc = (meta.get("content") if meta else None) or (og.get("content") if og else None)

    for sel in ["main", "article", "div.content", "div#content"]:
        m = soup.select_one(sel)
        if m: 
            return {"title": title, "meta_description": meta_desc, "content": txt(m)}
    return {"title": title, "meta_description": meta_desc, "content": None}
