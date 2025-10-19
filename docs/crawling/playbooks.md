# Domain Playbooks
_Last updated: 2025-10-19_

Playbooks define how official and NGO websites are crawled safely and reproducibly.

### Structure
Each playbook (JSON or YAML) describes:
- `domain`: hostname (e.g., arbeitsagentur.de)
- `seed_urls`: entry points
- `allowed_paths`: directories to follow
- `denied_paths`: exclude sections like /presse/ or /jobs/
- `extraction_rules`: CSS or XPath selectors for title, content, dates
- `metadata`: license hints, region, language, priority

### Crawl Workflow
1. Validate robots.txt and license status  
2. Fetch HTML → extract → normalize → save snapshot  
3. Run text cleaners and simple language translation  
4. Store version and mark differences from last run  

Playbooks live under `/services/scrapy_crawler/systemfehler/sources/` in the future MVP repo.
