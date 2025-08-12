# services/crawler/core/base.py
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Iterable, Dict, Any, List
import re, hashlib, datetime as dt

def slugify(url: str) -> str:
    return hashlib.sha1(url.encode("utf-8")).hexdigest()[:12]

@dataclass
class CrawlItem:
    url: str
    source: str
    topic: str | None = None

class Crawler(ABC):
    name: str                              # e.g. 'arbeitsagentur'
    default_max: int = 50

    def __init__(self, cfg: Dict[str, Any]):
        self.cfg = cfg

    @abstractmethod
    def discover(self) -> Iterable[CrawlItem]:
        """Yield CrawlItem with URLs to fetch (sitemaps, lists, etc.)."""
        ...

    @abstractmethod
    def fetch_one(self, item: CrawlItem) -> Dict[str, Any]:
        """Return normalized record for item.url (status, fields, etc.)."""
        ...

    def normalize(self, rec: Dict[str, Any]) -> Dict[str, Any]:
        rec.setdefault("source", self.name)
        rec.setdefault("language", ["de"])
        rec.setdefault("status", "ok")
        rec.setdefault("last_crawled_at", dt.datetime.utcnow().isoformat() + "Z")
        rec["id"] = slugify(rec["url"])
        return rec

# Simple registry
_REGISTRY: Dict[str, type[Crawler]] = {}

def register(cls: type[Crawler]):
    _REGISTRY[cls.__name__] = cls
    return cls

def create(name: str, cfg: Dict[str, Any]) -> Crawler:
    # allow using class name or plugin key
    for _, cls in _REGISTRY.items():
        if getattr(cls, "name", "").lower() == name.lower() or cls.__name__.lower() == name.lower():
            return cls(cfg)
    raise KeyError(f"crawler '{name}' not found")

def list_plugins() -> List[str]:
    return [getattr(cls, "name", cls.__name__) for cls in _REGISTRY.values()]
