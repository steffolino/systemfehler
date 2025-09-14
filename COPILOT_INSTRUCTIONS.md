# Copilot Guardrails — Scrapy-only, DB-first

Authoritative pipeline:
1) Scrapy spiders write ONLY into *_Staging tables (SQLite/Cloudflare D1).
2) A transform step normalizes into canonical tables and denormalizes into SearchDoc (+ FTS).
3) API reads ONLY from canonical tables/SearchDoc. No spider side-effects beyond staging writes.

Hard constraints:
- Use Scrapy built-ins only: `SitemapSpider`, `CrawlSpider` (or `Spider`). No Playwright/Selenium/requests/aiohttp.
- Do NOT change table/column names without a migration.
- Do NOT write to search or canonical tables from spiders.
- Keep identifiers stable: `org:<domain>`, `contact:<domain>:<path>`, `aid:<slug>`.

Cleanup (delete if present):
- `services/crawler/**` non-Scrapy runners or custom HTTP clients
- Any headless browser code (Playwright/Selenium), puppeteer scripts
- Old output writers that bypass DB (CSV/JSON dumps from spiders)
- Legacy search indexers not consuming SearchDoc

Only add/edit files explicitly listed in `/services/crawler`, `/services/api/db`, `/services/transform`, `/services/api/routes/search.ts`.

Optional cleanup script (run once, then commit):

git rm -r --cached \
  services/crawler/legacy* \
  services/crawler/*playwright* \
  services/crawler/*selenium* \
  services/crawler/**/requests_* \
  services/crawler/**/httpx_* \
  services/search/legacy* \
  services/api/legacy* || true
