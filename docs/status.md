# Systemfehler – Implementation Status

> **Last updated:** 2026-03-06
>
> This document is the single source of truth for "what is implemented today
> vs planned or stubbed". Update this file when the implementation status of
> any area changes.

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

**Crawlers not yet implemented in Python:**

| Domain | Status |
|--------|--------|
| `aid` | 🔲 Planned – no Python crawler yet |
| `tools` | 🔲 Planned – no Python crawler yet |
| `organizations` | 🔲 Planned – no Python crawler yet |
| `contacts` | 🔲 Planned – no Python crawler yet |

### Node.js API (`backend/`)

| Component | Status |
|-----------|--------|
| `backend/server.js` | ✅ Working |
| Express REST endpoints (`/api/health`, `/api/status`, `/api/data/*`) | ✅ Working |

### Frontend (`frontend/`)

| Component | Status |
|-----------|--------|
| Vite + React admin panel | ✅ Working |
| Data preview, quality metrics, moderation queue views | ✅ Working |

### Cloudflare Pages (`cloudflare-pages/`)

| Component | Status | Notes |
|-----------|--------|-------|
| Pages deploy workflow (`.github/workflows/deploy-pages.yml`) | ✅ Working | Frontend build uses `VITE_API_URL=/api`; deploy runs with `wrangler@4.71.0` and `--cwd=cloudflare-pages` |
| Pages Functions API | ✅ Working | Worker-safe handlers for `/api/health`, `/api/status`, `/api/data/entries`, `/api/data/entries/:id`, `/api/data/moderation-queue`, `/api/data/quality-report` |
| D1 schema (`cloudflare-pages/d1/schema.sql`) | ✅ Working | Includes `entries` and `moderation_queue` tables |

### Automated ingest (`.github/workflows/crawl-and-ingest.yml`)

| Component | Status | Notes |
|-----------|--------|-------|
| Crawl + ingest workflow | ✅ Working | Requires GitHub secrets `PAGES_INGEST_URL` and `INGEST_TOKEN` |
| `scripts/ingest_to_d1.py` | ✅ Working | Accepts both JSON array snapshots and `{ "entries": [...] }` snapshots |

### Validation scripts (`scripts/`)

| Script | `npm run` command | Status |
|--------|-------------------|--------|
| `scripts/validate_entries.js` | `npm run validate` | ✅ Working |
| `scripts/validate_entries.js --ci` | `npm run validate:ci` | ✅ Working |

---

## Schema locations and how validation runs

JSON schemas live in `data/_schemas/`:

```
data/_schemas/
  base.schema.json              – fields common to all entries
  extensions/
    benefits.schema.json
    aid.schema.json
    tools.schema.json
    organizations.schema.json
    contacts.schema.json
```

**Node validation (CI):**
```bash
npm run validate        # validates all entries in data/
npm run validate:ci     # same, exits non-zero on errors
```

**Python validation:**
```bash
python crawlers/cli.py validate --domain benefits
```

---

## Moderation storage modes

| Mode | When used | Path |
|------|-----------|------|
| File-based | Default / no DB | `moderation/review_queue.json` |
| PostgreSQL | `DATABASE_URL` is set | `moderation_queue` table |

The Python CLI writes to the file-based queue automatically. The Node.js API
reads from the database when `DATABASE_URL` is set, falling back to an empty
list otherwise.

---

## Commands expected to work today

```bash
# Crawl benefits (Python – canonical)
npm run crawl:benefits
# Equivalent: python crawlers/cli.py crawl benefits --source arbeitsagentur

# Validate all entries
npm run validate
npm run validate:ci

# Start API server (Node.js)
npm run api

# Start frontend dev server
npm run dev

# Start API + frontend together
npm run dev:all

# Import crawled data to PostgreSQL
npm run db:seed
# Requires: DATABASE_URL set in .env

# Import using Python directly
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
| `services/_link_expander/detect_links.js` | CRAWL-03 (#6) | Link expansion design (planned) |
| `services/_shared/url_normalization.js` | CRAWL-06 (#30) | URL normalisation design |

**`npm run crawl:aid/tools/organizations/contacts`** print an informative error
and exit non-zero because no Python crawlers for those domains exist yet.

---

## Next planned work

See open issues and `IMPLEMENTATION_SUMMARY.md` for details.

- Moderation workflow / diff alignment (MOD-01, #18)
- Canonical moderation queue format
- Cleanup TIME-03 duplicate
- Python crawlers for `aid`, `tools`, `organizations`, `contacts`
- Link expander (CRAWL-03, #6)
