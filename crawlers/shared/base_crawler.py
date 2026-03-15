"""
Systemfehler Base Crawler

Provides foundational functionality for all domain-specific crawlers including:
- HTTP fetching with rate limiting and retry logic
- HTML parsing and text extraction
- URL normalization
- Checksum calculation for change detection
- Structured logging
- Error handling
"""

import hashlib
import logging
import re
import time
import urllib.parse
from typing import Optional, Dict, Any, Iterable, List
from urllib.robotparser import RobotFileParser

import requests
from bs4 import BeautifulSoup


class BaseCrawler:
    """Base class for all Systemfehler crawlers"""

    SOURCE_CLASSIFICATION_RULES = (
        (
            (
                "bundestag.de",
                "bundesrat.de",
                "dip.bundestag.de",
            ),
            {"sourceTier": "tier_1_official", "institutionType": "parliament", "jurisdiction": "DE"},
        ),
        (
            (
                "bundesverfassungsgericht.de",
            ),
            {"sourceTier": "tier_1_official", "institutionType": "court", "jurisdiction": "DE"},
        ),
        (
            (
                "gesetze-im-internet.de",
                "bundesanzeiger.de",
            ),
            {"sourceTier": "tier_1_official", "institutionType": "legal_record", "jurisdiction": "DE"},
        ),
        (
            (
                "bundesregierung.de",
                "bmi.bund.de",
                "bka.de",
                "bfv.bund.de",
                "destatis.de",
                "arbeitsagentur.de",
                "bmas.de",
                "bmbfsfj.bund.de",
                "familienportal.de",
                "bafza.de",
                "115.de",
            ),
            {"sourceTier": "tier_1_official", "institutionType": "government", "jurisdiction": "DE"},
        ),
        (
            (
                "europa.eu",
                "commission.europa.eu",
                "europarl.europa.eu",
            ),
            {"sourceTier": "tier_1_official", "institutionType": "supranational", "jurisdiction": "EU"},
        ),
        (
            (
                "coe.int",
                "echr.coe.int",
                "ohchr.org",
                "un.org",
            ),
            {"sourceTier": "tier_1_official", "institutionType": "supranational", "jurisdiction": "INT"},
        ),
        (
            (
                "correctiv.org",
                "fragdenstaat.de",
                "digitalcourage.de",
                "netzpolitik.org",
                "abgeordnetenwatch.de",
                "gesellschaft-fuer-freiheitsrechte.de",
                "amnesty.org",
                "amnesty.de",
                "hrw.org",
                "transparency.org",
                "transparency.de",
                "freedomhouse.org",
                "accessnow.org",
                "edri.org",
                "privacyinternational.org",
                "epic.org",
                "rsf.org",
                "reporter-ohne-grenzen.de",
            ),
            {"sourceTier": "tier_2_ngo_watchdog", "institutionType": "ngo", "jurisdiction": "INT"},
        ),
        (
            (
                "spiegel.de",
                "zeit.de",
                "faz.net",
                "sueddeutsche.de",
                "tagesschau.de",
                "taz.de",
            ),
            {"sourceTier": "tier_3_press", "institutionType": "press", "jurisdiction": "DE"},
        ),
        (
            (
                "swp-berlin.org",
                "wzb.eu",
                "mpg.de",
                "uni-heidelberg.de",
                "hu-berlin.de",
                "fu-berlin.de",
                "tu-berlin.de",
                "uni-koeln.de",
                "ifo.de",
                "zew.de",
                "difu.de",
            ),
            {"sourceTier": "tier_4_academic", "institutionType": "academic", "jurisdiction": "DE"},
        ),
    )
    
    def __init__(self, name: str, user_agent: str, rate_limit_delay: float = 2.0):
        """
        Initialize base crawler
        
        Args:
            name: Crawler identifier (e.g., 'arbeitsagentur')
            user_agent: User agent string for HTTP requests
            rate_limit_delay: Delay in seconds between requests
        """
        self.name = name
        self.user_agent = user_agent
        self.rate_limit_delay = rate_limit_delay
        self.last_request_time = 0
        
        # Set up logging
        self.logger = self._setup_logger()
        
        # Session for connection pooling
        self.session = requests.Session()
        self.session.headers.update({'User-Agent': user_agent})
    
    def _setup_logger(self) -> logging.Logger:
        """Set up structured logging"""
        logger = logging.getLogger(f'systemfehler.crawler.{self.name}')
        logger.setLevel(logging.INFO)
        
        if not logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            )
            handler.setFormatter(formatter)
            logger.addHandler(handler)
        
        return logger
    
    def _enforce_rate_limit(self):
        """Enforce rate limiting between requests"""
        elapsed = time.time() - self.last_request_time
        if elapsed < self.rate_limit_delay:
            sleep_time = self.rate_limit_delay - elapsed
            self.logger.debug(f"Rate limiting: sleeping for {sleep_time:.2f}s")
            time.sleep(sleep_time)
        self.last_request_time = time.time()
    
    def check_robots_txt(self, url: str) -> bool:
        """
        Check if URL is allowed by robots.txt
        
        Args:
            url: URL to check
            
        Returns:
            True if allowed, False otherwise
        """
        try:
            parsed = urllib.parse.urlparse(url)
            robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
            
            rp = RobotFileParser()
            rp.set_url(robots_url)
            rp.read()
            
            allowed = rp.can_fetch(self.user_agent, url)
            if not allowed:
                self.logger.warning(f"URL blocked by robots.txt: {url}")
            return allowed
        except Exception as e:
            self.logger.warning(f"Could not check robots.txt: {e}")
            # If we can't check, err on the side of caution and allow
            return True
    
    def fetch_page(self, url: str, retry_count: int = 3, timeout: int = 30) -> Optional[str]:
        result = self.fetch_page_details(url, retry_count=retry_count, timeout=timeout)
        return result.get('html') if result else None

    def fetch_page_details(self, url: str, retry_count: int = 3, timeout: int = 30) -> Optional[Dict[str, Any]]:
        """
        Fetch HTML content from URL with retry logic.
        
        Args:
            url: URL to fetch
            retry_count: Number of retries on failure
            timeout: Request timeout in seconds
            
        Returns:
            Metadata dictionary containing HTML and response details, or None on failure
        """
        if not self.check_robots_txt(url):
            return None
        
        for attempt in range(retry_count):
            try:
                self._enforce_rate_limit()
                
                self.logger.info(f"Fetching {url} (attempt {attempt + 1}/{retry_count})")
                response = self.session.get(url, timeout=timeout)
                response.raise_for_status()
                
                # Detect encoding
                response.encoding = response.apparent_encoding
                
                self.logger.info(f"Successfully fetched {url}")
                return {
                    'html': response.text,
                    'requested_url': url,
                    'final_url': response.url,
                    'status_code': response.status_code,
                    'headers': dict(response.headers),
                }
                
            except requests.exceptions.RequestException as e:
                self.logger.warning(f"Attempt {attempt + 1} failed for {url}: {e}")
                
                if attempt < retry_count - 1:
                    # Exponential backoff
                    backoff_time = 2 ** attempt
                    self.logger.info(f"Retrying in {backoff_time}s...")
                    time.sleep(backoff_time)
                else:
                    self.logger.error(f"Failed to fetch {url} after {retry_count} attempts")
                    return None
        
        return None
    
    def parse_html(self, html: str) -> BeautifulSoup:
        """
        Parse HTML content with BeautifulSoup
        
        Args:
            html: HTML content string
            
        Returns:
            BeautifulSoup object
        """
        return BeautifulSoup(html, 'lxml')

    # ------------------------------
    # Title / Head helpers
    # ------------------------------
    def _is_nav_like(self, element: Optional[BeautifulSoup]) -> bool:
        """
        Heuristic to detect if an element is part of navigation/header/footer
        or has nav-like classes/ids (e.g., 'navigation', 'hauptnavigation', 'menu').
        Returns True when the element appears to be navigation rather than
        meaningful page content.
        """
        if not element:
            return False
        for parent in element.parents:
            if getattr(parent, 'name', None) in ("nav", "header", "footer", "aside"):
                return True
            cls = " ".join(parent.get("class", [])).lower() if parent.get("class") else ""
            pid = (parent.get("id") or "").lower()
            if any(tok in cls for tok in ("nav", "navigation", "menu", "hauptnavigation", "breadcrumb")):
                return True
            if any(tok in pid for tok in ("nav", "navigation", "menu", "hauptnavigation", "breadcrumb")):
                return True
        return False

    def _extract_meta_tag(self, soup: Optional[BeautifulSoup], keys: Iterable[str]) -> str:
        """Extract first matching meta tag content from the document head."""
        if not soup:
            return ""
        head = soup.find("head")
        if not head:
            return ""
        lookup = [key.lower() for key in keys]
        for meta in head.find_all("meta"):
            name_attr = (meta.get("name") or meta.get("property") or "").lower()
            if name_attr not in lookup:
                continue
            content = (meta.get("content") or "").strip()
            if content:
                return content
        return ""

    def _extract_head_title(self, soup: Optional[BeautifulSoup]) -> str:
        """Return the head <title> or common social meta titles (og: / twitter:).
        Empty string when no head title is available."""
        if not soup:
            return ""
        title_tag = soup.find("title")
        if title_tag:
            return self._normalize_title_text((title_tag.get_text(strip=True) or "").strip())
        return self._extract_meta_tag(soup, ["og:title", "twitter:title"]) or ""

    def _normalize_title_text(self, value: str) -> str:
        """Normalize page titles and strip common site-brand suffixes."""
        text = " ".join((value or "").split()).strip()
        if not text:
            return ""

        for separator in (" | ", " \u2013 ", " \u2014 ", " - "):
            if separator not in text:
                continue
            left, right = text.split(separator, 1)
            left = left.strip()
            right = right.strip()
            if left and right and len(left) >= 12:
                return left

        return text

    def _normalize_text_block(self, value: str) -> str:
        """Collapse whitespace and trim common decorative separators."""
        text = " ".join((value or "").split()).strip()
        text = re.sub(r"\s+([,.;:!?])", r"\1", text)
        return text.strip(" -|")

    def _is_low_quality_title(self, value: str) -> bool:
        text = (value or "").strip().lower()
        if not text:
            return True

        generic_titles = {
            "navigation",
            "hauptnavigation",
            "haupt-navigation",
            "startseite",
            "home",
            "homepage",
            "menu",
            "hinweis zum datenschutz",
            "datenschutz",
            "datenschutzhinweis",
            "impressum",
            "cookie-hinweis",
            "cookie hinweis",
        }
        if text in generic_titles:
            return True

        low_signal_tokens = (
            "jetzt",
            "hier klicken",
            "mehr erfahren",
            "loslegen",
            "starten",
            "anmelden",
            "datenschutz",
            "cookie",
            "impressum",
        )
        return any(token in text for token in low_signal_tokens)

    def _is_low_quality_description(self, value: str) -> bool:
        text = self._normalize_text_block(value).lower()
        if len(text) < 40:
            return True

        low_signal_tokens = (
            "cookie",
            "datenschutz",
            "javascript",
            "newsletter",
            "anmelden",
            "registrieren",
            "suche",
            "navigation",
            "zum inhalt",
            "barrierefreiheit",
            "impressum",
        )
        return any(token in text for token in low_signal_tokens)

    def _is_boilerplate_node(self, element: Optional[BeautifulSoup]) -> bool:
        """Detect nodes that likely belong to page chrome instead of main content."""
        if not element:
            return False

        current = element
        while current is not None:
            name = getattr(current, "name", None)
            if name in ("nav", "header", "footer", "aside", "form", "dialog", "noscript"):
                return True
            class_names = " ".join(current.get("class", [])).lower() if current.get("class") else ""
            element_id = (current.get("id") or "").lower()
            marker = f"{class_names} {element_id}"
            if any(
                token in marker
                for token in (
                    "nav",
                    "menu",
                    "breadcrumb",
                    "cookie",
                    "footer",
                    "header",
                    "sidebar",
                    "toolbar",
                    "pagination",
                    "search",
                    "newsletter",
                    "share",
                    "social",
                )
            ):
                return True
            current = current.parent
        return False

    def _extract_candidate_paragraphs(self, soup: Optional[BeautifulSoup], limit: int = 12) -> List[str]:
        """Collect meaningful paragraphs from the main content area."""
        if not soup:
            return []

        container = soup.find("main") or soup.find("article") or soup.find(attrs={"role": "main"}) or soup.find("body")
        if not container:
            return []

        paragraphs: List[str] = []
        seen = set()

        for paragraph in container.find_all(["p", "li"]):
            if self._is_boilerplate_node(paragraph):
                continue
            text = self._normalize_text_block(self.extract_text(paragraph))
            if len(text) < 50 or text in seen:
                continue
            seen.add(text)
            paragraphs.append(text)
            if len(paragraphs) >= limit:
                break

        return paragraphs

    def _extract_best_summary(self, soup: Optional[BeautifulSoup]) -> str:
        """Pick a frontend-usable short description for the entry."""
        if not soup:
            return ""

        selectors = [
            {"name": "meta", "attrs": {"name": "description"}},
            {"name": "meta", "attrs": {"property": "og:description"}},
            {"name": "meta", "attrs": {"name": "twitter:description"}},
            {"attrs": {"class": re.compile(r"(lead|intro|teaser|summary|abstract)", re.I)}},
            {"attrs": {"id": re.compile(r"(lead|intro|teaser|summary|abstract)", re.I)}},
        ]

        for selector in selectors:
            if selector.get("name") == "meta":
                candidate = self._extract_meta_tag(soup, [selector["attrs"].get("name") or selector["attrs"].get("property")])
            else:
                element = soup.find(**selector)
                candidate = self.extract_text(element) if element else ""
            candidate = self._normalize_text_block(candidate)
            if candidate and not self._is_low_quality_description(candidate):
                return candidate

        for paragraph in self._extract_candidate_paragraphs(soup, limit=4):
            if not self._is_low_quality_description(paragraph):
                return paragraph

        return ""

    def _extract_canonical_url(self, soup: Optional[BeautifulSoup], base_url: str = "") -> str:
        """Return canonical URL from the document head when available."""
        if not soup:
            return ""
        head = soup.find("head")
        if not head:
            return ""
        link = head.find("link", rel=lambda value: isinstance(value, str) and "canonical" in value.lower())
        if not link:
            return ""
        href = (link.get("href") or "").strip()
        if not href:
            return ""
        try:
            resolved = urllib.parse.urljoin(base_url, href) if base_url else href
            return self.normalize_url(resolved)
        except Exception:
            return href

    def _extract_datetime_meta(self, soup: Optional[BeautifulSoup], keys: Iterable[str]) -> str:
        """Extract publication or modification datetime metadata from common meta tags."""
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
            content = (meta.get("content") or meta.get("value") or "").strip()
            if content:
                return content
        return ""

    def _extract_publication_metadata(self, soup: Optional[BeautifulSoup]) -> Dict[str, str]:
        """Extract common publication timestamps and coarse content type."""
        published_at = self._extract_datetime_meta(
            soup,
            (
                "article:published_time",
                "og:published_time",
                "date",
                "dc.date",
                "dcterms.created",
                "publishdate",
                "published_time",
            ),
        )
        modified_at = self._extract_datetime_meta(
            soup,
            (
                "article:modified_time",
                "og:modified_time",
                "last-modified",
                "dcterms.modified",
                "modified_time",
            ),
        )
        return {
            "publishedAt": published_at,
            "modifiedAt": modified_at,
            "contentType": "html",
        }

    def classify_source_metadata(self, source_url: str) -> Dict[str, str]:
        """Return reusable source-tier metadata inferred from the source domain."""
        host = urllib.parse.urlparse(source_url).netloc.lower()
        if host.startswith("www."):
            host = host[4:]

        for hosts, payload in self.SOURCE_CLASSIFICATION_RULES:
            if any(host == candidate or host.endswith(f".{candidate}") for candidate in hosts):
                return dict(payload)

        return {
            "sourceTier": "tier_unknown",
            "institutionType": "unknown",
            "jurisdiction": "DE",
        }

    def _extract_best_content(self, soup: Optional[BeautifulSoup], summary: str = "", max_parts: int = 6) -> str:
        """Build a concise body text from the main content area."""
        parts: List[str] = []
        normalized_summary = self._normalize_text_block(summary)

        for paragraph in self._extract_candidate_paragraphs(soup, limit=max_parts + 2):
            if normalized_summary and paragraph == normalized_summary:
                continue
            parts.append(paragraph)
            if len(parts) >= max_parts:
                break

        if not parts and normalized_summary:
            return normalized_summary

        return " ".join(parts)

    def _get_best_title(self, soup: Optional[BeautifulSoup], seed_name: str = "", url: str = "") -> str:
        """Choose the most useful title for an entry.

        Preference order:
        1. `og:title` / `twitter:title`
        2. head `<title>`
        3. `h1` when not navigation/menu text and not CTA-like
        4. meta description truncated as last resort when title is generic
        5. fallback: "{seed_name} - {url}" or empty
        """
        title = ""
        meta_title = self._normalize_title_text(
            self._extract_meta_tag(soup, ["og:title", "twitter:title"]) or ""
        )
        head_title = self._normalize_title_text(self._extract_head_title(soup))

        if meta_title and not self._is_low_quality_title(meta_title):
            title = meta_title

        if not title and head_title and not self._is_low_quality_title(head_title):
            title = head_title

        if soup:
            try:
                h1 = soup.find("h1")
                if h1 and not self._is_nav_like(h1):
                    h1_title = self._normalize_title_text(h1.get_text(strip=True) or "")
                    if h1_title and not self._is_low_quality_title(h1_title):
                        title = h1_title
            except Exception:
                pass

        # Normalize obviously useless titles
        if title and self._is_low_quality_title(title):
            # try head title or meta description instead
            if head_title and not self._is_low_quality_title(head_title):
                return head_title
            if meta_title and not self._is_low_quality_title(meta_title):
                return meta_title
            meta_desc = self._extract_meta_tag(soup, ["description", "og:description", "twitter:description"]) or ""
            if meta_desc:
                return (meta_desc.strip()[:60] + "...") if len(meta_desc.strip()) > 60 else meta_desc.strip()

        if not title:
            if seed_name or url:
                return f"{seed_name} - {url}".strip()
            return ""

        return title
    
    def extract_text(self, element, clean: bool = True) -> str:
        """
        Extract text from BeautifulSoup element
        
        Args:
            element: BeautifulSoup element
            clean: Whether to clean whitespace
            
        Returns:
            Extracted text
        """
        if element is None:
            return ""
        
        text = element.get_text(separator=' ', strip=True)
        
        if clean:
            # Clean up multiple spaces and newlines
            text = ' '.join(text.split())
        
        return text
    
    def normalize_url(self, url: str) -> str:
        """
        Normalize URL for consistency
        
        Args:
            url: URL to normalize
            
        Returns:
            Normalized URL
        """
        parsed = urllib.parse.urlparse(url)
        
        # Convert to lowercase hostname
        netloc = parsed.netloc.lower()
        
        # Remove default ports
        if netloc.endswith(':80'):
            netloc = netloc[:-3]
        elif netloc.endswith(':443'):
            netloc = netloc[:-4]
        
        # Remove tracking parameters
        tracking_params = {
            'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
            'fbclid', 'gclid', 'ref', 'source', 'mc_cid', 'mc_eid'
        }
        
        query_params = urllib.parse.parse_qs(parsed.query)
        cleaned_params = {
            k: v for k, v in query_params.items()
            if k not in tracking_params
        }
        
        # Sort query parameters for consistency
        sorted_query = urllib.parse.urlencode(sorted(cleaned_params.items()), doseq=True)
        
        # Normalize path (remove trailing slash unless it's the root)
        path = parsed.path
        if path != '/' and path.endswith('/'):
            path = path[:-1]
        
        # Reconstruct URL
        normalized = urllib.parse.urlunparse((
            parsed.scheme,
            netloc,
            path,
            parsed.params,
            sorted_query,
            ''  # Remove fragment
        ))
        
        return normalized
    
    def calculate_checksum(self, content: str) -> str:
        """
        Calculate SHA-256 checksum of content for change detection
        
        Args:
            content: Content to hash
            
        Returns:
            Hex-encoded SHA-256 checksum
        """
        return hashlib.sha256(content.encode('utf-8')).hexdigest()

    def _classify_source_metadata(self, source_url: str) -> Dict[str, str]:
        parsed = urllib.parse.urlparse(source_url or "")
        host = (parsed.netloc or "").lower()
        host = host[4:] if host.startswith("www.") else host

        official_hosts = (
            "arbeitsagentur.de",
            "bmas.de",
            "bmbfsfj.bund.de",
            "bundesregierung.de",
            "fitko.de",
            "115.de",
            "bafza.de",
        )
        ngo_hosts = (
            "sanktionsfrei.de",
            "plattform.sanktionsfrei.de",
            "caritas.de",
            "diakonie.de",
            "weisser-ring.de",
            "telefonseelsorge.de",
            "nummergegenkummer.de",
            "dajeb.de",
            "frauenhauskoordinierung.de",
            "deutsche-depressionshilfe.de",
        )

        if any(host == domain or host.endswith(f".{domain}") for domain in official_hosts):
            return {
                "sourceTier": "tier_1_official",
                "institutionType": "government",
                "jurisdiction": "DE",
            }
        if any(host == domain or host.endswith(f".{domain}") for domain in ngo_hosts):
            return {
                "sourceTier": "tier_2_ngo_watchdog",
                "institutionType": "ngo",
                "jurisdiction": "DE",
            }

        return {
            "sourceTier": "tier_unknown",
            "institutionType": "unknown",
            "jurisdiction": "DE",
        }
    
    def generate_provenance(
        self,
        source_url: str,
        crawl_id: Optional[str] = None,
        source_metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Generate provenance metadata
        
        Args:
            source_url: Source URL
            crawl_id: Optional crawl run identifier
            
        Returns:
            Provenance dictionary
        """
        from datetime import datetime
        
        provenance = {
            'source': source_url,
            'crawledAt': datetime.utcnow().isoformat() + 'Z',
            'crawlId': crawl_id or f"{self.name}-{int(time.time())}",
            'crawlerVersion': '0.1.0'
        }
        provenance.update(source_metadata or self._classify_source_metadata(source_url))
        return provenance
    
    def close(self):
        """Clean up resources"""
        self.session.close()
