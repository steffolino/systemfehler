"""
Federal Source Crawler

Crawls multiple German federal domains defined in the registry data/_sources/federal_de.json
and persists detailed failure reports so broken sources can be triaged quickly.
"""

from __future__ import annotations

import json
import logging
import os
import socket
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Set, Tuple
from urllib.parse import urljoin, urlparse
from xml.etree import ElementTree as ET

import requests
from bs4 import BeautifulSoup

from ..shared.base_crawler import BaseCrawler
from ..shared.quality_scorer import QualityScorer

logger = logging.getLogger(__name__)


class FederalSourceCrawler(BaseCrawler):
    """Crawler for official German federal sources."""

    EXCLUDED_LINK_KEYWORDS: Tuple[str, ...] = (
        "datenschutz",
        "privacy",
        "impressum",
        "barriere",
        "cookie",
    )
    MAX_ALLOWED_PATHS = 25
    MAX_SITEMAP_URLS = 500
    MAX_SITEMAP_DEPTH = 2

    def __init__(
        self,
        data_dir: str,
        source_name: Optional[str] = None,
        user_agent: Optional[str] = None,
        rate_limit: float = 2.0,
    ) -> None:
        user_agent = user_agent or "Systemfehler/0.1.0 (Federal Source Crawler)"
        super().__init__("federal", user_agent, rate_limit)

        resolved_data_dir = os.path.abspath(data_dir)
        if os.path.isfile(resolved_data_dir):
            resolved_data_dir = os.path.dirname(resolved_data_dir)

        registry_root = self._discover_registry_root(resolved_data_dir)
        self.data_dir = registry_root

        suffix = source_name or "all"
        self.logger = logging.getLogger(f"systemfehler.crawler.federal.{suffix}")

        self._robots_cache: Dict[str, Dict[str, Any]] = {}
        self._host_resolution_cache: Dict[str, Tuple[bool, Optional[str]]] = {}
        self._head_probe_cache: Dict[str, Tuple[bool, Optional[str]]] = {}

        self.failed_urls_path = os.path.join(self.data_dir, "benefits", "failed_urls.jsonl")
        self._failed_url_records = self._load_failed_url_records()

        registry_path = os.path.join(self.data_dir, "_sources", "federal_de.json")
        with open(registry_path, "r", encoding="utf-8") as handle:
            self.registry = json.load(handle)

        if source_name:
            filtered = [
                seed
                for seed in self.registry.get("seed_groups", [])
                if seed.get("name", "").lower() == source_name.lower()
            ]
            if not filtered:
                raise ValueError(f"Source '{source_name}' not found in registry")
            self.seed_groups = filtered
        else:
            self.seed_groups = self.registry.get("seed_groups", [])

        if not self.seed_groups:
            raise ValueError("Federal registry seed_groups is empty")

        self.crawl_rules = self.registry.get("crawl_rules", {})

    def crawl(self) -> List[Dict[str, Any]]:
        """Crawl all configured seed groups."""

        all_entries: List[Dict[str, Any]] = []
        for seed_group in self.seed_groups:
            self.logger.info("Crawling %s", seed_group.get("name"))
            try:
                entries = self._crawl_seed_group(seed_group)
            except Exception as exc:  # pragma: no cover - defensive guard
                self.logger.error("Failed to crawl %s: %s", seed_group.get("name"), exc)
                continue
            all_entries.extend(entries)

        return all_entries

    # ------------------------------------------------------------------
    # Seed discovery helpers
    # ------------------------------------------------------------------
    def _crawl_seed_group(self, seed_group: Dict[str, Any]) -> List[Dict[str, Any]]:
        entries: List[Dict[str, Any]] = []
        crawl_targets = self._collect_crawl_targets(seed_group)

        failures: List[Tuple[str, str]] = []
        recovered: List[str] = []

        for url in crawl_targets:
            entry, failure_reason = self._crawl_url(url, seed_group)
            if entry:
                entries.append(entry)
                recovered.append(url)
            else:
                failures.append((url, failure_reason or "unknown"))

        if failures or recovered:
            self._record_failed_urls(seed_group.get("name", "unknown"), failures, recovered)

        return entries

    def _collect_crawl_targets(self, seed_group: Dict[str, Any]) -> List[str]:
        derived_allowed = self._derive_allowed_urls(seed_group)
        derived_sitemap = self._derive_sitemap_urls(seed_group)
        retry_targets = self._load_failed_urls(seed_group.get("name", ""))

        combined = list(
            dict.fromkeys(
                (seed_group.get("start_urls") or [])
                + derived_allowed
                + derived_sitemap
                + retry_targets
            )
        )

        specific_allowed_by_origin: Dict[str, bool] = {}
        for url in derived_allowed + derived_sitemap:
            parsed = urlparse(url)
            if parsed.scheme and parsed.netloc and parsed.path not in ("", "/"):
                specific_allowed_by_origin[f"{parsed.scheme}://{parsed.netloc}"] = True

        filtered_targets: List[str] = []
        seen: Set[str] = set()
        for url in combined:
            normalized = self.normalize_url(url)
            if normalized in seen:
                continue
            seen.add(normalized)

            parsed = urlparse(normalized)
            origin = f"{parsed.scheme}://{parsed.netloc}" if parsed.scheme and parsed.netloc else ""
            if origin and parsed.path in ("", "/") and specific_allowed_by_origin.get(origin):
                self.logger.debug("Skipping %s because more specific paths are available", normalized)
                continue

            if self._should_skip_link("", normalized):
                continue

            filtered_targets.append(normalized)

        return filtered_targets

    def _derive_allowed_urls(self, seed_group: Dict[str, Any]) -> List[str]:
        allowed: List[str] = []
        seen: Set[str] = set()
        for url in seed_group.get("start_urls", []):
            parsed = urlparse(url)
            if not parsed.scheme or not parsed.netloc:
                continue
            origin = f"{parsed.scheme}://{parsed.netloc}"
            metadata = self._get_robots_metadata(origin)
            for allowed_url in metadata.get("allowed_paths", []):
                if allowed_url in seen:
                    continue
                if self._should_skip_link("", allowed_url):
                    continue
                allowed.append(allowed_url)
                seen.add(allowed_url)
                if len(allowed) >= self.MAX_ALLOWED_PATHS:
                    return allowed
        return allowed

    def _derive_sitemap_urls(self, seed_group: Dict[str, Any]) -> List[str]:
        sitemap_urls: List[str] = []
        seen: Set[str] = set()
        visited_sitemaps: Set[str] = set()
        allowed_domains = [domain.lower() for domain in seed_group.get("allowed_domains", [])]

        for start_url in seed_group.get("start_urls", []):
            parsed = urlparse(start_url)
            if not parsed.scheme or not parsed.netloc:
                continue
            metadata = self._get_robots_metadata(f"{parsed.scheme}://{parsed.netloc}")
            for sitemap_url in metadata.get("sitemaps", []):
                if len(sitemap_urls) >= self.MAX_SITEMAP_URLS:
                    break
                collected = self._fetch_sitemap_urls(
                    sitemap_url,
                    allowed_domains,
                    visited_sitemaps,
                )
                for candidate in collected:
                    normalized = self.normalize_url(candidate)
                    if normalized in seen:
                        continue
                    if self._should_skip_link("", normalized):
                        continue
                    if not self._is_in_allowed_domains(normalized, allowed_domains):
                        continue
                    sitemap_urls.append(normalized)
                    seen.add(normalized)
                    if len(sitemap_urls) >= self.MAX_SITEMAP_URLS:
                        break
            if len(sitemap_urls) >= self.MAX_SITEMAP_URLS:
                break
        return sitemap_urls

    # ------------------------------------------------------------------
    # Fetch aids
    # ------------------------------------------------------------------
    def _get_robots_metadata(self, origin: str) -> Dict[str, Any]:
        if origin in self._robots_cache:
            return self._robots_cache[origin]

        robots_url = urljoin(origin, "/robots.txt")
        metadata = {"allowed_paths": [], "sitemaps": []}
        try:
            response = self.session.get(robots_url, timeout=15)
            response.raise_for_status()
            metadata = self._parse_robots_file(response.text, origin)
        except requests.RequestException as exc:
            self.logger.warning("Unable to retrieve robots.txt from %s: %s", robots_url, exc)

        if not metadata["sitemaps"]:
            metadata["sitemaps"].append(self.normalize_url(urljoin(origin, "/sitemap.xml")))

        metadata["allowed_paths"] = list(dict.fromkeys(metadata["allowed_paths"]))
        metadata["sitemaps"] = list(dict.fromkeys(metadata["sitemaps"]))

        self._robots_cache[origin] = metadata
        return metadata

    def _parse_robots_file(self, robots_text: str, origin: str) -> Dict[str, Any]:
        allowed_paths: List[str] = []
        sitemaps: List[str] = []
        applies_to_us = False
        agent_token = self.user_agent.lower()

        for raw_line in robots_text.splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#"):
                continue

            lower = line.lower()
            if lower.startswith("user-agent:"):
                declared = line.split(":", 1)[1].strip()
                if not declared:
                    applies_to_us = False
                    continue
                applies_to_us = declared == "*" or declared.lower() in agent_token
                continue

            if lower.startswith("sitemap:"):
                ref = line.split(":", 1)[1].strip()
                if not ref:
                    continue
                sitemaps.append(self.normalize_url(urljoin(origin, ref)))
                continue

            if not applies_to_us:
                continue

            if lower.startswith("allow:"):
                path = line.split(":", 1)[1].strip()
                if not path:
                    continue
                cleaned = path.split("#", 1)[0].strip().rstrip("*$")
                if not cleaned or not cleaned.startswith("/"):
                    continue
                allowed_paths.append(self.normalize_url(urljoin(origin, cleaned)))

        return {"allowed_paths": allowed_paths, "sitemaps": sitemaps}

    def _fetch_sitemap_urls(
        self,
        sitemap_url: str,
        allowed_domains: Sequence[str],
        visited_sitemaps: Set[str],
        depth: int = 0,
    ) -> List[str]:
        urls: List[str] = []
        if depth > self.MAX_SITEMAP_DEPTH:
            return urls

        normalized = self.normalize_url(sitemap_url)
        if normalized in visited_sitemaps:
            return urls
        visited_sitemaps.add(normalized)

        try:
            response = self.session.get(sitemap_url, timeout=30)
            response.raise_for_status()
        except requests.RequestException as exc:
            self.logger.debug("Failed to fetch sitemap %s: %s", sitemap_url, exc)
            return urls

        try:
            root = ET.fromstring(response.content)
        except ET.ParseError as exc:
            self.logger.warning("Unable to parse sitemap %s: %s", sitemap_url, exc)
            return urls

        tag = self._local_tag(root.tag)
        if tag == "sitemapindex":
            for sitemap in root:
                if len(urls) >= self.MAX_SITEMAP_URLS:
                    break
                if self._local_tag(sitemap.tag) != "sitemap":
                    continue
                child_loc = None
                for child in sitemap:
                    if self._local_tag(child.tag) == "loc":
                        child_loc = (child.text or "").strip()
                        break
                if not child_loc or child_loc.endswith(".gz"):
                    continue
                if not self._is_in_allowed_domains(child_loc, allowed_domains):
                    continue
                nested = self._fetch_sitemap_urls(child_loc, allowed_domains, visited_sitemaps, depth + 1)
                for candidate in nested:
                    if len(urls) >= self.MAX_SITEMAP_URLS:
                        break
                    urls.append(candidate)
        elif tag == "urlset":
            for url_entry in root:
                if len(urls) >= self.MAX_SITEMAP_URLS:
                    break
                if self._local_tag(url_entry.tag) != "url":
                    continue
                loc_value = None
                for child in url_entry:
                    if self._local_tag(child.tag) == "loc":
                        loc_value = (child.text or "").strip()
                        break
                if not loc_value:
                    continue
                if not self._is_in_allowed_domains(loc_value, allowed_domains):
                    continue
                urls.append(loc_value)
        else:
            for loc in root.iter():
                if len(urls) >= self.MAX_SITEMAP_URLS:
                    break
                if self._local_tag(loc.tag) != "loc":
                    continue
                value = (loc.text or "").strip()
                if not value:
                    continue
                if not self._is_in_allowed_domains(value, allowed_domains):
                    continue
                urls.append(value)

        return urls

    # ------------------------------------------------------------------
    # Crawl execution
    # ------------------------------------------------------------------
    def _crawl_url(self, url: str, seed_group: Dict[str, Any]) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https") or not parsed.netloc:
            return None, "invalid_url"

        reachable, reason = self._is_host_reachable(parsed.hostname or "")
        if not reachable:
            return None, reason or "host_unreachable"

        head_ok, head_reason = self._probe_url_head(url)
        if not head_ok:
            return None, head_reason or "head_failed"

        html = self.fetch_page(url)
        if not html:
            return None, "fetch_failed"

        soup = self.parse_html(html)
        normalized = self.normalize_url(url)
        allowed_domains = [domain.lower() for domain in seed_group.get("allowed_domains", [])]

        title = self._extract_title(soup, seed_group.get("name", ""), normalized)
        summary = self._extract_summary(soup)
        content = self._extract_main_content(soup)
        if not content:
            return None, "content_empty"

        related_links = self._extract_related_links(soup, normalized, allowed_domains)

        timestamp = datetime.now(timezone.utc).isoformat()
        entry = {
            "id": str(uuid.uuid5(uuid.NAMESPACE_URL, normalized)),
            "title": {"de": title},
            "summary": {"de": summary} if summary else {},
            "content": {"de": content},
            "url": normalized,
            "topics": [seed_group.get("default_topic")],
            "tags": [],
            "targetGroups": ["general"],
            "status": "active",
            "firstSeen": timestamp,
            "lastSeen": timestamp,
            "sourceUnavailable": False,
            "relatedLinks": related_links,
            "providerName": seed_group.get("provider_name"),
            "providerLevel": seed_group.get("provider_level"),
            "geographicScope": "Germany-wide",
            "official": True,
            "applicationChannel": [],
            "benefitType": [],
            "rawHtml": html,
            "head": {},
        }

        provenance = self.generate_provenance(url)
        provenance["crawler"] = f"federal_{seed_group.get('name', '').lower().replace(' ', '_')}"
        entry["provenance"] = provenance

        scorer = QualityScorer()
        entry["qualityScores"] = scorer.calculate_scores(entry)

        # Attach head metadata (title, description) if available
        try:
            head_title = self._extract_head_title(soup)
            head_desc = self._extract_meta_tag(soup, ["description", "og:description", "twitter:description"]) or ""
            if head_title or head_desc:
                entry["head"] = {"title": head_title, "description": head_desc}
        except Exception:
            # Non-fatal: don't break crawling if head extraction fails
            pass

        return entry, None

    def _extract_title(self, soup: BeautifulSoup, seed_name: str, url: str) -> str:
        def is_nav_like(element: BeautifulSoup) -> bool:
            """Return True if element is inside a nav/header/footer or has nav-like classes/ids"""
            if not element:
                return False
            for parent in element.parents:
                if parent.name in ("nav", "header", "footer", "aside"):
                    return True
                # check classes and ids for nav-like tokens
                cls = " ".join(parent.get("class", [])).lower() if parent.get("class") else ""
                pid = (parent.get("id") or "").lower()
                if any(tok in cls for tok in ("nav", "navigation", "menu", "hauptnavigation", "breadcrumb")):
                    return True
                if any(tok in pid for tok in ("nav", "navigation", "menu", "hauptnavigation", "breadcrumb")):
                    return True
            return False

        title = ""
        # Prefer H1 if it's not navigation/menu text
        if soup:
            h1 = soup.find("h1")
            if h1 and not is_nav_like(h1):
                title = h1.get_text(strip=True)

        # Fall back to head <title>
        if not title:
            title_tag = soup.find("title") if soup else None
            if title_tag:
                title = (title_tag.get_text(strip=True) or "").split("|")[0].strip()

        # Fall back to og/twitter meta titles
        if not title:
            title = self._extract_meta_tag(soup, ["og:title", "twitter:title"]) or ""

        # As a last resort, compose from seed name and URL
        if not title:
            title = f"{seed_name} - {url}"

        # Normalize obviously useless titles
        if title.strip().lower() in ("navigation", "hauptnavigation", "haupt-navigation"):
            # Prefer head title or meta description instead
            head_title = self._extract_head_title(soup) or ""
            if head_title and head_title.strip().lower() not in ("navigation", "hauptnavigation"):
                return head_title
            meta_desc = self._extract_meta_tag(soup, ["description", "og:description", "twitter:description"]) or ""
            if meta_desc:
                # Use first 60 chars of meta description as a fallback title
                return (meta_desc.strip()[:60] + "...") if len(meta_desc.strip()) > 60 else meta_desc.strip()

        return title

    def _extract_head_title(self, soup: Optional[BeautifulSoup]) -> str:
        if not soup:
            return ""
        title_tag = soup.find("title")
        if title_tag:
            return title_tag.get_text(strip=True)
        return self._extract_meta_tag(soup, ["og:title", "twitter:title"]) or ""

    def _extract_meta_description(self, soup: Optional[BeautifulSoup]) -> str:
        """Return the best available description meta tag for the page."""
        if not soup:
            return ""

        preferred_keys: List[Sequence[str]] = [
            ("description",),
            ("og:description",),
            ("twitter:description",),
            ("description", "og:description", "twitter:description"),
        ]

        for keys in preferred_keys:
            meta_val = self._extract_meta_tag(soup, keys)
            if meta_val:
                return meta_val.strip()

        head = soup.find("head")
        if not head:
            return ""

        fuzzy_tokens = ("description", "teaser", "summary", "abstract", "intro")
        for meta in head.find_all("meta"):
            name_attr = (
                meta.get("name")
                or meta.get("property")
                or meta.get("itemprop")
                or meta.get("http-equiv")
                or ""
            ).lower()
            if not name_attr or not any(token in name_attr for token in fuzzy_tokens):
                continue
            content = (meta.get("content") or meta.get("value") or "").strip()
            if content:
                return content

        return ""

    def _extract_summary(self, soup: BeautifulSoup) -> str:
        meta_summary = self._extract_meta_description(soup)
        if meta_summary:
            return meta_summary

        main = soup.find("main") if soup else None
        container = main or (soup.find("body") if soup else None)
        if not container:
            return ""

        call_to_action_tokens = (
            "jetzt",
            "starte",
            "bewirb",
            "bewerben",
            "anmelden",
            "los",
            "hier klicken",
        )
        for paragraph in container.find_all("p"):
            text = paragraph.get_text(strip=True)
            if not text:
                continue
            normalized = text.lower()
            if any(token in normalized for token in call_to_action_tokens):
                continue
            if len(text.split()) < 6:
                continue
            return text[:500]

        return ""

    def _extract_related_links(self, soup: BeautifulSoup, base_url: str, allowed_domains: Sequence[str]) -> List[Dict[str, Any]]:
        scope = soup.find("main") if soup else None
        if not scope:
            scope = soup.find("body") if soup else None
        related: List[Dict[str, Any]] = []
        seen: Set[str] = set()
        if not scope:
            return related
        for link in scope.find_all("a", href=True):
            if len(related) >= 20:
                break
            text = link.get_text(strip=True)
            href = link["href"].strip()
            if not text or not href:
                continue
            if href.startswith(("mailto:", "tel:", "javascript:")):
                continue
            absolute = urljoin(base_url, href)
            normalized = self.normalize_url(absolute)
            if normalized in seen:
                continue
            if self._should_skip_link(text, normalized):
                continue
            kind = "page"
            parsed = urlparse(normalized)
            is_internal = any(parsed.netloc.endswith(domain) for domain in allowed_domains if domain)
            if normalized.lower().endswith(".pdf"):
                kind = "pdf"
            elif not is_internal:
                kind = "external"
            relation = self._classify_link_relation(text.lower())
            related.append({
                "title": text,
                "url": normalized,
                "relation": relation,
                "type": kind,
            })
            seen.add(normalized)
        return related

    def _classify_link_relation(self, text: str) -> str:
        if any(token in text for token in ("antrag", "apply", "beantragen")):
            return "apply"
        if any(token in text for token in ("rechner", "calculator", "berechnen")):
            return "calculator"
        if any(token in text for token in ("faq", "fragen", "questions")):
            return "faq"
        if any(token in text for token in ("kontakt", "contact")):
            return "contact"
        if any(token in text for token in ("gesetz", "law", "recht")):
            return "law"
        return "unknown"

    def _extract_meta_tag(self, soup: Optional[BeautifulSoup], keys: Iterable[str]) -> str:
        if not soup:
            return ""
        head = soup.find("head")
        if not head:
            return ""
        lookup = [key.lower() for key in keys]
        for meta in head.find_all("meta"):
            name_attr = (
                meta.get("name")
                or meta.get("property")
                or meta.get("itemprop")
                or meta.get("http-equiv")
                or ""
            ).lower()
            if name_attr not in lookup:
                continue
            content = (meta.get("content") or "").strip()
            if content:
                return content
        return ""

    def _extract_main_content(self, soup: Optional[BeautifulSoup]) -> str:
        candidates = []
        if soup:
            for selector in ("article", "main", "body"):
                element = soup.find(selector)
                if element:
                    candidates.append(element)
        for candidate in candidates:
            cleaned = self._clean_content_container(candidate)
            text = cleaned.get_text(" ", strip=True)
            if len(text) >= 200:
                return text
        if soup:
            soup_copy = BeautifulSoup(str(soup), "lxml")
            cleaned_full = self._clean_content_container(soup_copy)
            return cleaned_full.get_text(" ", strip=True)
        return ""

    def _clean_content_container(self, element: BeautifulSoup) -> BeautifulSoup:
        removable_tags = ["nav", "header", "footer", "aside", "script", "style", "form", "noscript"]
        container = BeautifulSoup(str(element), "lxml")
        for tag_name in removable_tags:
            for tag in container.find_all(tag_name):
                tag.decompose()
        for tag in container.find_all(attrs={"class": True}):
            tokens = " ".join(tag.get("class", [])).lower()
            if any(keyword in tokens for keyword in ("cookie", "banner", "modal", "tracking", "breadcrumb")):
                tag.decompose()
        for tag in container.find_all(attrs={"id": True}):
            token = (tag.get("id") or "").lower()
            if any(keyword in token for keyword in ("cookie", "banner", "modal", "tracking", "breadcrumb")):
                tag.decompose()
        return container

    # ------------------------------------------------------------------
    # Reachability safeguards
    # ------------------------------------------------------------------
    def _is_host_reachable(self, host: str) -> Tuple[bool, Optional[str]]:
        if not host:
            return False, "invalid_host"
        if host in self._host_resolution_cache:
            return self._host_resolution_cache[host]
        try:
            socket.getaddrinfo(host, None)
            result = (True, None)
        except socket.gaierror as exc:
            code = getattr(exc, "errno", None)
            result = (False, f"dns_error:{code}" if code is not None else "dns_error")
        except OSError as exc:  # pragma: no cover - safety belt
            code = getattr(exc, "errno", None)
            result = (False, f"network_error:{code}" if code is not None else "network_error")
        self._host_resolution_cache[host] = result
        return result

    def _probe_url_head(self, url: str) -> Tuple[bool, Optional[str]]:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https") or not parsed.netloc:
            return False, "invalid_url"

        root = f"{parsed.scheme}://{parsed.netloc}/"
        if root in self._head_probe_cache:
            return self._head_probe_cache[root]

        try:
            response = self.session.head(root, timeout=10, allow_redirects=True)
        except requests.RequestException as exc:
            result = (False, f"head_error:{exc.__class__.__name__}")
            self._head_probe_cache[root] = result
            return result

        if response.status_code == 405:
            result = (True, None)
        elif response.status_code >= 500:
            result = (False, f"head_status:{response.status_code}")
        else:
            result = (True, None)

        self._head_probe_cache[root] = result
        return result

    # ------------------------------------------------------------------
    # Failure logging
    # ------------------------------------------------------------------
    def _load_failed_url_records(self) -> List[Dict[str, Any]]:
        records: List[Dict[str, Any]] = []
        path = Path(self.failed_urls_path)
        if not path.exists():
            return records
        try:
            with path.open("r", encoding="utf-8") as handle:
                for line in handle:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        record = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    if isinstance(record, dict) and record.get("url") and record.get("source"):
                        records.append(record)
        except OSError as exc:  # pragma: no cover
            self.logger.warning("Could not read failed URL log at %s: %s", path, exc)
        return records

    def _load_failed_urls(self, seed_name: str) -> List[str]:
        if not seed_name:
            return []
        return [record["url"] for record in self._failed_url_records if record.get("source") == seed_name]

    def _record_failed_urls(
        self,
        source: str,
        failures: List[Tuple[str, str]],
        recovered: List[str],
    ) -> None:
        if recovered:
            self._failed_url_records = [
                record
                for record in self._failed_url_records
                if not (record.get("source") == source and record.get("url") in recovered)
            ]

        if failures:
            now = datetime.now(timezone.utc).isoformat()
            for url, reason in failures:
                if not url:
                    continue
                existing = next(
                    (
                        record
                        for record in self._failed_url_records
                        if record.get("source") == source and record.get("url") == url
                    ),
                    None,
                )
                if existing:
                    existing["lastFailure"] = now
                    existing["failCount"] = existing.get("failCount", 1) + 1
                    if reason:
                        existing["reason"] = reason
                else:
                    record: Dict[str, Any] = {
                        "source": source,
                        "url": url,
                        "failCount": 1,
                        "lastFailure": now,
                    }
                    if reason:
                        record["reason"] = reason
                    self._failed_url_records.append(record)

        self._persist_failed_url_records()

    def _persist_failed_url_records(self) -> None:
        path = Path(self.failed_urls_path)
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            with path.open("w", encoding="utf-8") as handle:
                for record in self._failed_url_records:
                    handle.write(json.dumps(record, ensure_ascii=False) + "\n")
        except OSError as exc:  # pragma: no cover
            self.logger.warning("Could not write failed URL log: %s", exc)

    # ------------------------------------------------------------------
    # Utility helpers
    # ------------------------------------------------------------------
    @staticmethod
    def _local_tag(tag: str) -> str:
        if not tag:
            return ""
        if "}" in tag:
            return tag.split("}", 1)[1].lower()
        return tag.lower()

    def _is_in_allowed_domains(self, url: str, allowed_domains: Sequence[str]) -> bool:
        if not allowed_domains:
            return True
        netloc = urlparse(url).netloc.lower()
        return any(netloc.endswith(domain) for domain in allowed_domains if domain)

    def _should_skip_link(self, text: str, url: str) -> bool:
        haystack = f"{text} {url}".lower()
        return any(keyword in haystack for keyword in self.EXCLUDED_LINK_KEYWORDS)

    @staticmethod
    def _discover_registry_root(candidate: str) -> str:
        registry_root = candidate
        if os.path.isdir(os.path.join(registry_root, "_sources")):
            return registry_root
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        fallbacks = [candidate, project_root, os.path.join(project_root, "data")]
        for path in fallbacks:
            if os.path.isdir(os.path.join(path, "_sources")):
                return path
        raise FileNotFoundError("Could not locate federal source registry")

    # ------------------------------------------------------------------
    # Output helpers
    # ------------------------------------------------------------------
    def save_candidates(self, entries: List[Dict[str, Any]], output_path: str) -> None:
        output_dir = Path(output_path).parent
        output_dir.mkdir(parents=True, exist_ok=True)

        source_name = self.seed_groups[0]["name"].lower().replace(" ", "_") if self.seed_groups else "federal"
        payload = {
            "version": "0.1.0",
            "domain": "benefits",
            "crawlDate": datetime.now(timezone.utc).isoformat(),
            "source": source_name,
            "entries": entries,
        }

        with open(output_path, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2, ensure_ascii=False)

        self.logger.info("Saved %d candidate entries to %s", len(entries), output_path)


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Federal benefits crawler")
    parser.add_argument("data_dir", nargs="?", default=os.path.join(os.path.dirname(__file__), "..", "..", "data"))
    parser.add_argument("--source", dest="source_name")
    args = parser.parse_args()

    crawler = FederalSourceCrawler(args.data_dir, source_name=args.source_name)
    entries = crawler.crawl()
    print(f"Extracted {len(entries)} entries")
    if entries:
        print(json.dumps(entries[0], indent=2, ensure_ascii=False))


if __name__ == "__main__":  # pragma: no cover
    main()
