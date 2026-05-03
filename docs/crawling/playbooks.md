# Domain Playbooks
_Last updated: 2026-05-03_

Playbooks define how official and NGO websites are crawled safely and reproducibly.

Current runtime truth:
- Python in `crawlers/` is the only canonical crawl runtime.
- Node crawler files under `services/*/crawler/` remain reference-only stubs.

### Structure
Each playbook/profile input describes:
- `domain`: hostname (e.g., arbeitsagentur.de)
- `seed_urls`: entry points
- `allowed_paths`: directories to follow
- `denied_paths`: exclude sections like /presse/ or /jobs/
- `extraction_rules`: CSS or XPath selectors for title, content, dates
- `metadata`: license hints, region, language, priority

### Crawl Workflow
1. Validate robots.txt and license status  
2. Fetch HTML → extract → normalize → save snapshot  
3. Validate against schema and quality checks  
4. Promote candidates into canonical snapshots via deterministic filter  
5. Store version and mark differences from last run  

### Current locations in this repo

- Trusted topic profiles and seed roles: `data/_topics/trusted_topic_sources.json`
- Source registry metadata: `data/_sources/registered_sources.json`
- Crawl state and metrics outputs: `data/<domain>/url_status.jsonl`, `data/<domain>/crawl_metrics.json`
- Promotion pipeline: `scripts/promote_candidates_to_snapshots.py`
