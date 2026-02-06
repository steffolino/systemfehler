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
import time
import urllib.parse
from typing import Optional, Dict, Any, Iterable
from urllib.robotparser import RobotFileParser

import requests
from bs4 import BeautifulSoup


class BaseCrawler:
    """Base class for all Systemfehler crawlers"""
    
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
        """
        Fetch HTML content from URL with retry logic
        
        Args:
            url: URL to fetch
            retry_count: Number of retries on failure
            timeout: Request timeout in seconds
            
        Returns:
            HTML content as string, or None on failure
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
                return response.text
                
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
            return (title_tag.get_text(strip=True) or "").strip()
        return self._extract_meta_tag(soup, ["og:title", "twitter:title"]) or ""

    def _get_best_title(self, soup: Optional[BeautifulSoup], seed_name: str = "", url: str = "") -> str:
        """Choose the most useful title for an entry.

        Preference order:
        1. `h1` when not navigation/menu text
        2. head `<title>`
        3. `og:title` / `twitter:title`
        4. meta description truncated as last resort when title is generic
        5. fallback: "{seed_name} - {url}" or empty
        """
        title = ""
        if soup:
            try:
                h1 = soup.find("h1")
                if h1 and not self._is_nav_like(h1):
                    title = (h1.get_text(strip=True) or "").strip()
            except Exception:
                title = ""

        if not title:
            title = self._extract_head_title(soup)

        if not title:
            title = self._extract_meta_tag(soup, ["og:title", "twitter:title"]) or ""

        # Normalize obviously useless titles
        if title and title.strip().lower() in ("navigation", "hauptnavigation", "haupt-navigation"):
            # try head title or meta description instead
            head_title = self._extract_head_title(soup) or ""
            if head_title and head_title.strip().lower() not in ("navigation", "hauptnavigation"):
                return head_title
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
    
    def generate_provenance(self, source_url: str, crawl_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Generate provenance metadata
        
        Args:
            source_url: Source URL
            crawl_id: Optional crawl run identifier
            
        Returns:
            Provenance dictionary
        """
        from datetime import datetime
        
        return {
            'source': source_url,
            'crawler': self.name,
            'crawledAt': datetime.utcnow().isoformat() + 'Z',
            'crawlId': crawl_id or f"{self.name}-{int(time.time())}"
        }
    
    def close(self):
        """Clean up resources"""
        self.session.close()
