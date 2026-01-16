# Crawling Guide

This guide explains how to use the Systemfehler crawler infrastructure, add new crawlers, and follow best practices for ethical and effective web scraping.

## Table of Contents

1. [Overview](#overview)
2. [Using Existing Crawlers](#using-existing-crawlers)
3. [Creating New Crawlers](#creating-new-crawlers)
4. [Best Practices](#best-practices)
5. [Schema Compliance](#schema-compliance)
6. [Debugging](#debugging)

---

## Overview

The Systemfehler crawler infrastructure consists of:

- **Base Crawler Class** (`crawlers/shared/base_crawler.py`): Provides common functionality
- **Domain-Specific Crawlers** (e.g., `crawlers/benefits/arbeitsagentur_crawler.py`): Extract domain-specific data
- **Shared Utilities**: Validator, quality scorer, diff generator
- **CLI Interface** (`crawlers/cli.py`): Command-line tool for running crawlers

### Architecture

```
┌─────────────────┐
│   CLI / npm     │
└────────┬────────┘
         │
         v
┌─────────────────┐
│ Domain Crawler  │  (e.g., ArbeitsagenturCrawler)
└────────┬────────┘
         │
         v
┌─────────────────┐
│  Base Crawler   │  (HTTP, parsing, rate limiting)
└────────┬────────┘
         │
         ├──> Validator (JSON schema)
         ├──> Quality Scorer (IQS, AIS)
         ├──> Diff Generator (change detection)
         └──> Database Importer
```

---

## Using Existing Crawlers

### Arbeitsagentur Benefits Crawler

Crawls benefits information from Bundesagentur für Arbeit.

**Run the crawler:**

```bash
npm run crawl:benefits
```

Or with Python directly:

```bash
python crawlers/cli.py crawl benefits --source arbeitsagentur
```

**What it does:**

1. Fetches https://www.arbeitsagentur.de/arbeitslosengeld-2
2. Respects robots.txt
3. Applies rate limiting (2 second delay between requests)
4. Extracts:
   - Title
   - Summary
   - Content
   - Benefit amount
   - Eligibility criteria
   - Application steps
   - Required documents
5. Validates against `data/_schemas/extensions/benefits.schema.json`
6. Calculates quality scores (IQS and AIS)
7. Generates provenance metadata
8. Saves to `data/benefits/candidates.json`
9. Creates diffs and adds to moderation queue

---

## Creating New Crawlers

### Step 1: Create Crawler File

Create a new Python file in the appropriate domain directory:

```bash
mkdir -p crawlers/{domain}
touch crawlers/{domain}/{source}_crawler.py
touch crawlers/{domain}/__init__.py
```

Example: `crawlers/aid/caritas_crawler.py`

### Step 2: Implement Crawler Class

```python
"""
Systemfehler {Domain} Crawler for {Source}

Crawls {description} from {source}.
Target URL: {url}
"""

from ..shared.base_crawler import BaseCrawler
from ..shared.quality_scorer import QualityScorer
from ..shared.validator import SchemaValidator

class {Source}Crawler(BaseCrawler):
    """Crawler for {Source} {domain} information"""
    
    TARGET_URL = "https://example.com"
    
    def __init__(self, user_agent: str, rate_limit_delay: float = 2.0):
        super().__init__('{source}', user_agent, rate_limit_delay)
        self.quality_scorer = QualityScorer()
        self.validator = SchemaValidator()
    
    def crawl(self) -> List[Dict[str, Any]]:
        """Main crawl method"""
        self.logger.info(f"Starting crawl of {self.TARGET_URL}")
        
        # Fetch page
        html = self.fetch_page(self.TARGET_URL)
        if not html:
            return []
        
        # Parse and extract
        soup = self.parse_html(html)
        entries = self.extract_entries(soup)
        
        # Add metadata to each entry
        for entry in entries:
            entry['id'] = str(uuid.uuid4())
            entry['url'] = self.normalize_url(self.TARGET_URL)
            entry['status'] = 'active'
            entry['firstSeen'] = datetime.now(timezone.utc).isoformat()
            entry['lastSeen'] = datetime.now(timezone.utc).isoformat()
            
            # Add provenance
            content_checksum = self.calculate_checksum(
                json.dumps(entry, sort_keys=True)
            )
            entry['provenance'] = self.generate_provenance(self.TARGET_URL)
            entry['provenance']['checksum'] = content_checksum
            
            # Calculate quality scores
            entry['qualityScores'] = self.quality_scorer.calculate_scores(entry)
        
        return entries
    
    def extract_entries(self, soup) -> List[Dict[str, Any]]:
        """Extract entries from parsed HTML"""
        entries = []
        
        # Your extraction logic here
        # ...
        
        return entries
```

### Step 3: Add Extraction Methods

Implement helper methods for extracting specific fields:

```python
def _extract_title(self, soup):
    """Extract page title"""
    h1 = soup.find('h1')
    if h1:
        return self.extract_text(h1)
    return "Default Title"

def _extract_summary(self, soup):
    """Extract summary/introduction"""
    # Look for intro paragraph
    intro = soup.find('p', class_='intro')
    if intro:
        return self.extract_text(intro)
    return ""

def _extract_content(self, soup):
    """Extract main content"""
    main = soup.find('main')
    if main:
        paragraphs = main.find_all('p')
        return ' '.join([self.extract_text(p) for p in paragraphs])
    return ""
```

### Step 4: Update CLI

Add support for your new crawler in `crawlers/cli.py`:

```python
def crawl_domain(source: str, output_dir: str):
    """Crawl domain data from specified source"""
    
    # ... existing code ...
    
    if source == 'your_source':
        from crawlers.domain.your_source_crawler import YourSourceCrawler
        crawler = YourSourceCrawler(user_agent, rate_limit)
    else:
        logger.error(f"Unknown source: {source}")
        return False
```

### Step 5: Test Your Crawler

```bash
# Test crawling
python crawlers/cli.py crawl {domain} --source {source} --output ./data

# Validate output
python crawlers/cli.py validate --domain {domain}

# Import to database
python crawlers/cli.py import --domain {domain} --to-db
```

---

## Best Practices

### 1. Respect robots.txt

The base crawler automatically checks robots.txt. Do not bypass this check.

```python
# This is handled automatically by base_crawler
if not self.check_robots_txt(url):
    return None
```

### 2. Use Rate Limiting

Always apply appropriate delays between requests:

```python
# Default: 2 seconds between requests
crawler = YourCrawler(user_agent, rate_limit_delay=2.0)

# For high-traffic sites or during business hours, increase delay
crawler = YourCrawler(user_agent, rate_limit_delay=5.0)
```

### 3. Handle Errors Gracefully

Use try-except blocks and log errors:

```python
try:
    entry = self.extract_entry(soup)
except Exception as e:
    self.logger.error(f"Failed to extract entry: {e}")
    return None
```

### 4. Identify Your Crawler

Use a descriptive user agent:

```python
# In .env
CRAWLER_USER_AGENT=Systemfehler/0.1.0 (+https://github.com/steffolino/systemfehler)
```

### 5. Cache Results

Avoid re-crawling the same content:

```python
# Check if entry already exists
existing_by_url = {e['url']: e for e in existing_entries}
if url in existing_by_url:
    old_entry = existing_by_url[url]
    # Compare checksums to detect changes
    if old_entry.get('provenance', {}).get('checksum') == new_checksum:
        self.logger.info(f"No changes detected for {url}")
        continue
```

### 6. Log Activities

Use structured logging:

```python
self.logger.info(f"Starting crawl of {url}")
self.logger.debug(f"Found {len(entries)} entries")
self.logger.warning(f"Missing field: {field}")
self.logger.error(f"Failed to parse: {error}")
```

### 7. Validate Early

Validate extracted data before processing:

```python
# Validate entry
validation_result = self.validator.validate_entry(entry, 'benefits')
if not validation_result['valid']:
    self.logger.error(f"Validation failed: {validation_result['errors']}")
    continue
```

---

## Schema Compliance

All crawled entries must comply with JSON schemas defined in `data/_schemas/`.

### Core Schema

Required fields from `core.schema.json`:

- `id` (UUID v4)
- `title` (multilingual object with at least 'de')
- `url` (source URL)
- `status` ('active', 'discontinued', 'archived', 'under_revision')
- `provenance` (source, crawler, crawledAt, checksum)

### Domain Extensions

Domain-specific fields from extension schemas:

**Benefits** (`benefits.schema.json`):
- `benefitAmount` (multilingual)
- `eligibilityCriteria` (multilingual)
- `applicationSteps` (array of multilingual objects)
- `requiredDocuments` (array of multilingual objects)

**Aid** (`aid.schema.json`):
- Similar structure to benefits

### Validation

```python
from crawlers.shared.validator import SchemaValidator

validator = SchemaValidator()
result = validator.validate_entry(entry, 'benefits')

if result['valid']:
    print("✓ Entry is valid")
else:
    print("✗ Validation errors:")
    for error in result['errors']:
        print(f"  - {error}")

if result['warnings']:
    print("⚠ Warnings:")
    for warning in result['warnings']:
        print(f"  - {warning}")
```

---

## Debugging

### Enable Debug Logging

Set logging level in your crawler:

```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

### Inspect HTML

Save fetched HTML for manual inspection:

```python
html = self.fetch_page(url)
with open('/tmp/debug.html', 'w') as f:
    f.write(html)
```

### Test Selectors

Use Python REPL or Jupyter notebook:

```python
from bs4 import BeautifulSoup
import requests

html = requests.get(url).text
soup = BeautifulSoup(html, 'lxml')

# Test selectors
soup.find('h1')
soup.find_all('p', class_='intro')
soup.select('.content > p')
```

### Check robots.txt

Manually check the site's robots.txt:

```bash
curl https://example.com/robots.txt
```

### Test Rate Limiting

Monitor request timing:

```python
import time

start = time.time()
html = self.fetch_page(url)
end = time.time()
print(f"Request took {end - start:.2f} seconds")
```

### Validate JSON Output

Use jq to inspect JSON files:

```bash
# Pretty print
cat data/benefits/candidates.json | jq .

# Check schema compliance
cat data/benefits/candidates.json | jq '.entries[0] | keys'

# Find entries with low quality scores
cat data/benefits/entries.json | jq '.entries[] | select(.qualityScores.iqs < 50)'
```

---

## Common Issues

### Issue: Empty Results

**Cause**: HTML structure changed or selectors are wrong

**Solution**:
1. Fetch the page manually and inspect HTML
2. Update your CSS selectors or BeautifulSoup queries
3. Check if the site uses JavaScript rendering (requires Selenium)

### Issue: Validation Errors

**Cause**: Missing required fields or wrong data types

**Solution**:
1. Check the schema: `data/_schemas/extensions/{domain}.schema.json`
2. Ensure all required fields are present
3. Verify multilingual fields have correct structure: `{"de": "...", "en": "..."}`

### Issue: Rate Limiting / Blocked

**Cause**: Too many requests too quickly

**Solution**:
1. Increase `rate_limit_delay`
2. Add random jitter to delays
3. Respect robots.txt crawl-delay directive
4. Contact site administrator if necessary

---

## Further Reading

- `data/_schemas/` - JSON schema definitions
- `backend/database/schema.sql` - Database schema
- `docs/architecture.md` - System architecture
- `docs/setup.md` - Setup instructions
