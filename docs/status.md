# Systemfehler – Implementation Status

> **Last updated:** 2026-03-15
>
> Major frontend and admin dashboard improvements, TypeScript config enhancements, new reusable components, and expanded test coverage were completed in the latest session. The frontend is now fully integrated as part of the monorepo (no separate git repo). See below for details.

For the consolidated repo view across live issues, current docs, and runtime
code, also see `docs/current-state.md`.

Verification note:

- Validation was re-run on 2026-03-15 after the seeded crawl scaling pass.
- Current result: 1006 entries, 0 schema/structural errors, 994 lint warnings.
- The remaining warnings are currently dominated by missing Easy German
  translations on newly promoted seeded entries.

---

## Canonical crawling pipeline

**Python `crawlers/` is authoritative for all crawling, diff generation, and
schema validation steps.**

Node.js files under `services/*/crawler/` are reference stubs only. They
document the intended design but **do not execute**. Do not add runtime
crawling logic to these files.

---

## What is working today

### Python crawler (`crawlers/`)

| Component | Status | Notes |
|-----------|--------|-------|
| `crawlers/cli.py` | ✅ Working | Entrypoint for all crawl / validate / import commands |
| `crawlers/benefits/arbeitsagentur_crawler.py` | ✅ Working | Fetches benefit info from Bundesagentur für Arbeit |
| `crawlers/shared/base_crawler.py` | ✅ Working | Rate-limiting, robots.txt, HTTP retry logic |
| `crawlers/shared/validator.py` | ✅ Working | JSON schema validation |
| `crawlers/shared/quality_scorer.py` | ✅ Working | IQS / AIS quality score calculation |
| `crawlers/shared/diff_generator.py` | ✅ Working | Change detection and moderation-queue diff format |
| `crawlers/aid/seeded_crawler.py` | ✅ Working | Crawls seeded aid URLs from `data/aid/urls.json` |
| `crawlers/tools/seeded_crawler.py` | ✅ Working | Crawls seeded tools URLs from `data/tools/urls.json` |
| `crawlers/organizations/seeded_crawler.py` | ✅ Working | Crawls seeded organization URLs from `data/organizations/urls.json` |
| `crawlers/contacts/seeded_crawler.py` | ✅ Working | Crawls seeded contact URLs from `data/contacts/urls.json` |
| `crawlers/shared/link_expander.py` | ✅ Working | Python link discovery and URL queue expansion (CRAWL-03) |
| `data/<domain>/url_status.jsonl` | ✅ Working | Persistent URL crawl state for redirects, canonical aliases, and skip-worthy failures |
| `data/<domain>/crawl_metrics.json` | ✅ Working | Per-run crawl metrics with quality averages, failure reasons, source-tier distribution, and improvement hints |
| `scripts/promote_candidates_to_snapshots.py` | ✅ Working | Deterministic promotion filter that merges only high-quality crawler candidates into canonical snapshots |

### Node.js API (`backend/`)


### Cloudflare Worker API (`cloudflare-workers/`)

| Component | Status | Notes |
|-----------|--------|-------|
| Worker deploy workflow (`wrangler.worker.toml`) | ✅ Working | API live: https://systemfehler-api-worker.inequality.workers.dev, deploy with `npx wrangler deploy --config wrangler.worker.toml` |
| Worker API Routing | ✅ Working | Endpoints `/api/health`, `/api/version`, `/api/data/entries`, `/api/data/entries/:id` |
| D1 Binding | ✅ Working | [[d1_databases]] in wrangler.worker.toml, database_id correct |
| CORS Handling | ✅ Working | Access-Control-Allow-Origin set everywhere |
| Encoding/Search Fixes | ✅ Working | UTF-8 encoding and improved search logic for German terms (e.g. 'Bürgergeld') |
| Troubleshooting | ✅ Working | See setup.md for troubleshooting |

### Frontend (`frontend/`)

| Component | Status |
|-----------|--------|
| Vite + React admin panel | ✅ Working |
| Public source directory (`/sources`) | ✅ Working | Aggregates visible sources from entry provenance with tier, jurisdiction, domain coverage, and average quality signals |
| Backend unit-test harness | ✅ Working | `node:test` covers Express/query helpers and `unittest` covers AI sidecar cache/provider/endpoints without extra dependencies |
| Public AI search mode | ✅ Working | AI search is now the default public search mode; classic search remains available as article-based search |
| Frontend language toggle | 🟡 Experimental | Lightweight app-level `de` / `en` UI translation support exists for the public shell and search/source pages |
| Data preview, quality metrics, moderation queue views | ✅ Working |
| AI search tab | 🟡 Experimental |

### Cloudflare Pages (`cloudflare-pages/`)

| Component | Status | Notes |
|-----------|--------|-------|
| Pages deploy workflow (`.github/workflows/deploy-pages.yml`) | ✅ Working | Frontend build uses `VITE_API_URL=/api` and injects public frontend vars for Turnstile/Auth0; deploy runs with `wrangler@4.71.0` and `--cwd=cloudflare-pages` |
| Pages Functions API | ✅ Working | Worker-safe handlers for `/api/health`, `/api/status`, `/api/data/entries`, `/api/data/entries/:id`, `/api/data/moderation-queue`, `/api/data/quality-report` |
| D1 schema (`cloudflare-pages/d1/schema.sql`) | ✅ Working | Includes `entries` and `moderation_queue` tables |

### Automated ingest (`.github/workflows/crawl-and-ingest.yml`)

| Component | Status | Notes |
|-----------|--------|-------|
| Crawl + ingest workflow | ✅ Working | Requires GitHub secrets `PAGES_INGEST_URL` and `INGEST_TOKEN` |
| `scripts/ingest_to_d1.py` | ✅ Working | Accepts both JSON array snapshots and `{ "entries": [...] }` snapshots |


### Validation scripts (`scripts/`)
| PostgreSQL | `DATABASE_URL` is set | `moderation_queue` table |

**Schema/data compliance:**
- All `title` fields are now strings (never objects) across all domains and tests.
- All IDs are UUID strings, not objects.
- Datetime serialization allows `None` and uses ISO format.
- Moderation queue format is canonical and validated.
- Seeded snapshot promotion is now deterministic and taxonomy-aware.

**Infra/config:**
- Backend and scripts now use the `PORT` environment variable for configuration (no more hardcoded ports).
- All Python and integration tests now pass.

The Python CLI writes to the file-based queue automatically. The Node.js API reads from the database when `DATABASE_URL` is set, and falls back to `moderation/review_queue.json` when the DB queue is unavailable/empty.

### Canonical moderation queue entry format

`moderation/review_queue.json` and API responses now use a canonical camelCase
entry shape and keep compatibility aliases where needed:

- `id`, `entryId`, `domain`, `action`, `status`
- `candidateData`, `existingData`, `diff`, `diffSummary`, `importantChanges`
- `provenance` (must include `source`, `crawledAt`, `crawlerVersion`)
- `reviewedBy`, `reviewedAt`, `createdAt`, `updatedAt`

Reference schema: `data/_schemas/moderation_queue.schema.json`

---

## Commands expected to work today

```bash
# Crawl benefits (Python – canonical)
npm run crawl:benefits
# Equivalent: python crawlers/cli.py crawl benefits --source arbeitsagentur

# Crawl additional domains (Python – seeded URLs)
npm run crawl:aid
npm run crawl:tools
npm run crawl:organizations
npm run crawl:contacts

# Expand URL queues from discovered links (CRAWL-03)
npm run expand:links

# Validate all entries
npm run validate
npm run validate:ci

# Migrate moderation queue to canonical format
npm run moderation:migrate

# Start API server (Node.js)
npm run api

# Start frontend dev server
npm run dev

# Start API + frontend together
npm run dev:all

# Replace PostgreSQL data from current snapshots
npm run db:seed
# Requires: DATABASE_URL set in .env

# Import one domain using Python directly
python crawlers/cli.py import --domain benefits --to-db

# Trigger crawl + ingest workflow
gh workflow run "Crawl and Ingest" --repo steffolino/systemfehler
```

---

## Known stubs / reference-only areas

These files exist as design scaffolding. They document the intended
architecture but throw `Error('Not implemented …')` at runtime.

| File | Issue | Reference for |
|------|-------|---------------|
| `services/_shared/crawler_base.js` | CRAWL-01 (#4) | Node crawler base design |
| `services/benefits/crawler/index.js` | CRAWL-02 (#5) | Node benefits crawler design |
| `services/aid/crawler/index.js` | CRAWL-01 (#4) | Node aid crawler design |
| `services/tools/crawler/index.js` | CRAWL-01 (#4) | Node tools crawler design |
| `services/organizations/crawler/index.js` | CRAWL-01 (#4) | Node organizations crawler design |
| `services/contacts/crawler/index.js` | CRAWL-01 (#4) | Node contacts crawler design |
| `services/_link_expander/detect_links.js` | CRAWL-03 (#6) | Node reference-only design; Python implementation is in `crawlers/shared/link_expander.py` |
| `services/_shared/url_normalization.js` | CRAWL-06 (#30) | URL normalisation design |

Node crawler files remain reference-only stubs. Runtime crawling is implemented
in Python and available through the CLI and npm wrappers.



## Current scaled dataset

Validated canonical snapshot counts after the March 15 crawl/promotion pass:

| Domain | Entries |
|--------|---------|
| `benefits` | 5 |
| `aid` | 140 |
| `tools` | 127 |
| `organizations` | 379 |
| `contacts` | 355 |
| **Total** | **1006** |

The local PostgreSQL refresh path (`npm run db:seed`) was re-run successfully
against this 1006-entry corpus.

## Next planned work

- Finalize and document the canonical moderation queue format; ensure file and DB backends are fully interchangeable.
- Update all schema docs to clarify that `title` is always a string and IDs are UUID strings.
- Expand test coverage for edge cases (e.g., missing/optional fields, invalid UUIDs, datetime `None`).
- Begin implementing Phase 4 of the AI roadmap (AI-assisted metadata tagging, duplicate detection, etc.).
- Add more detailed logging and cost tracking for all AI/model calls.
- Improve Easy German coverage on newly promoted seeded entries to reduce the
  remaining validator warnings.
- Regularly update `docs/status.md` and `docs/ai-roadmap.md` as new features are stabilized.

See open issues and `IMPLEMENTATION_SUMMARY.md` for details.

----

## Recent link expansion results

Python link expander (`crawlers/shared/link_expander.py`) was run across all domains:

| Domain         | URLs before | URLs after |
| -------------- | ---------- | ---------- |
| benefits       | 5          | 257        |
| aid            | 5          | 226        |
| tools          | 5          | 478        |
| organizations  | 5          | 706        |
| contacts       | 5          | 581        |

Expanded URL queues are now available for all domains, enabling broader crawling and candidate discovery.

---

## Crawler coverage summary

All seeded domain crawlers (aid, tools, organizations, contacts) are implemented and working. Link expansion is fully integrated and operational. Moderation queue format is canonical and validated. See above for details.
### AI sidecar (`backend/ai_service/`)

| Component | Status | Notes |
|-----------|--------|-------|
| FastAPI gateway | ✅ Working | Runs via `npm run ai:api` |
| Provider adapter layer | ✅ Working | Supports `AI_PROVIDER=none|ollama|openai` |
| Query rewrite / synthesize / enrich endpoints | 🟡 Experimental | Real provider calls when configured; graceful fallback when disabled or unreachable |
| Structured metadata enrichment suggestions | ✅ Working | `/enrich` returns deterministic-first suggestions for `topics`, `tags`, `target_groups`, and `keywords`, with quality flags and admin-facing rationale |
