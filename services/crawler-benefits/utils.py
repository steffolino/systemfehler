import requests
from bs4 import BeautifulSoup
import json
import os

def fetch_page_data(url):
    try:
        res = requests.get(url, timeout=10)
        res.raise_for_status()
        soup = BeautifulSoup(res.text, 'html.parser')

        return {
            "url": url,
            "title": soup.title.string.strip() if soup.title else None,
            "meta_description": get_meta_description(soup)
        }
    except Exception as e:
        print(f"⚠️ Error fetching {url}: {e}")
        return None

def get_meta_description(soup):
    tag = soup.find("meta", attrs={"name": "description"})
    return tag["content"].strip() if tag and "content" in tag.attrs else None

def save_data(filename, data):
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

