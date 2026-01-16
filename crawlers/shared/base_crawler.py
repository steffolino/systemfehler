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
from typing import Optional, Dict, Any
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
