Cloudflare Pages deployment

This folder contains Cloudflare Pages Functions for a D1-backed API used by the
frontend when deployed to Cloudflare Pages.

Current production frontend + API hosting is Cloudflare Pages.

The deployment workflow builds the frontend app from `frontend/` and deploys:
- static site: `frontend/dist`
- Pages Functions from `cloudflare-pages/functions` (via `wrangler pages deploy --cwd=cloudflare-pages`)
- bundled moderation fallback asset copied into the deploy artifact:
  - `moderation/review_queue.json`

## API Endpoints

- `/api/health` -> health check
- `/api/status` -> aggregated stats for dashboard cards
- `/api/data/entries` -> list entries (`domain`, `status`, `search`, `limit`, `offset`, `includeTranslations`)
- `/api/data/entries/:id` -> single entry
- `/api/data/moderation-queue` -> moderation queue from D1 table `moderation_queue`
- `/api/data/quality-report` -> quality metrics + missing translation report
- `/api/ai/health` -> Workers AI health/config
- `/api/ai/rewrite` -> query rewrite
- `/api/ai/retrieve` -> retrieval-only evidence
- `/api/ai/synthesize` -> retrieval-backed answer synthesis
- `/api/ai/enrich` -> lightweight enrichment fallback

`/api/ai/retrieve` and `/api/ai/synthesize` support optional request fields:
- `retrieval_mode`: `keyword | hybrid | external`
- `strict_official`: `true | false`
- `min_source_tier`: source-tier floor (for example `tier_2_official`)
- `min_confidence`: confidence floor from `0.0` to `1.0`

## Required GitHub Secrets

Set these in repository settings (`Settings -> Secrets and variables -> Actions`):

- `CF_PAGES_API_TOKEN`
- `CF_ACCOUNT_ID`

For automated D1 ingest from workflows (`crawl-and-ingest.yml` and post-deploy in `deploy-pages.yml`):

- `PAGES_INGEST_URL` (e.g. `https://systemfehler.pages.dev`)
- `INGEST_TOKEN` (must match the Cloudflare Pages secret `INGEST_TOKEN`)

## Required GitHub Actions Variables

Set these as repository or environment variables for the Pages frontend build:

- `VITE_TURNSTILE_SITE_KEY`
- `VITE_AUTH0_DOMAIN`
- `VITE_AUTH0_CLIENT_ID`

These are public frontend values and are injected at build time by
`.github/workflows/deploy-pages.yml`.

The Pages build also sets `VITE_AI_API_URL=/api/ai`, so deployed AI requests go
to same-origin Cloudflare Pages Functions instead of the local Python sidecar.

## Cloudflare Project Setup

1. Create a Cloudflare Pages project named `systemfehler`.
2. You do not need to configure Cloudflare-side build commands if using the GitHub Actions deploy workflow.
3. Ensure production branch is `main`.
4. In **Pages -> Settings -> Environment variables / Secrets**, add server-side secrets:
   - `TURNSTILE_SECRET_KEY`
   - `INGEST_TOKEN`
5. In **Pages -> Settings -> Environment variables**, add non-secret values if they are consumed by Functions:
   - `PAGES_BASE_URL` (for example `https://systemfehler.pages.dev`)
6. In **Pages -> Settings -> Functions**, add bindings:
   - D1 binding: `DB`
   - Workers AI binding: `AI`
7. Optionally add a non-secret environment variable:
   - `CF_AI_MODEL` (defaults to `@cf/meta/llama-3.1-8b-instruct`)
   - `AI_RATE_LIMIT_WINDOW_SECONDS` (defaults to `60`)
   - `AI_RATE_LIMIT_MAX_REQUESTS` (defaults to `12`)
   - `AI_CACHE_TTL_RETRIEVE_SECONDS` (defaults to `180`)
   - `AI_CACHE_TTL_REWRITE_SECONDS` (defaults to `3600`)
   - `AI_CACHE_TTL_SYNTHESIZE_SECONDS` (defaults to `900`)
   - `AI_MAX_BODY_BYTES` (defaults to `100000`)
   - `AI_RETRIEVAL_MODE` (`keyword` default, optional `hybrid` or `external`)
   - `AI_RETRIEVAL_STRICT_OFFICIAL` (`true|false`, default `false`)
   - `AI_RETRIEVAL_MIN_SOURCE_TIER` (optional floor, e.g. `tier_2_official`)
   - `AI_RETRIEVAL_MIN_CONFIDENCE` (optional floor `0.0..1.0`)
   - `AI_RETRIEVAL_ENDPOINT` (external retrieval endpoint for hybrid/external mode)
   - `AI_RETRIEVAL_API_KEY` (optional bearer token used for external retrieval calls)
   - `AI_RETRIEVAL_ALLOWED_HOSTS` (optional comma-separated host allowlist for external endpoint)
   - `AI_RETRIEVAL_TIMEOUT_MS` (defaults to `7000`, max `15000`)
   - `CORS_ALLOWED_ORIGINS` (comma-separated extra origins allowed for CORS; same-origin is always allowed)
   - `INGEST_MAX_BODY_BYTES` (defaults to `8000000`)
   - `INGEST_MAX_ENTRIES` (defaults to `1500`)

## Deployment Trigger

Deployment runs from `.github/workflows/deploy-pages.yml` on:
- pushes to `main`
- manual workflow dispatch

After Pages deploy, the workflow also attempts to sync all domain snapshots into D1
via `scripts/ingest_all_to_d1.py` (when `PAGES_INGEST_URL` and `INGEST_TOKEN` are set).
The ingest client uses chunked uploads to avoid `413 Payload Too Large` on large domains.

## Manual deployment (local)

Use the same sequence as CI:

1. Build frontend artifact:
   - `cd frontend && npm ci && npm run build`
2. Assemble deploy directory:
   - copy `frontend/dist/*` into `dist-pages/`
3. Deploy Cloudflare Pages project:
   - `npx wrangler pages deploy ../dist-pages --project-name=systemfehler --branch=main --cwd=cloudflare-pages`
4. Apply D1 schema when needed:
   - `npx wrangler d1 execute systemfehler-db --remote --file=cloudflare-pages/d1/schema.sql`
5. Sync snapshots to D1 (all domains):
   - `python scripts/ingest_all_to_d1.py`
6. Optional separate worker deploy (non-primary path):
   - `npx wrangler deploy --config wrangler.worker.toml`

## Local development (recommended)

From repo root:

1. Start full local Pages stack:
   - `npm run dev:all`
   - this includes local D1 reset + reseed
2. Fast restart without reseeding D1:
   - `npm run dev:all:fast`
3. Open:
   - `http://127.0.0.1:8788`

Helper commands:
- `npm run prepare:dist-pages` (build frontend + copy topic packs to `dist-pages`)
- `npm run dev:pages:d1:reset` (reset local D1 schema + seed entries chunked)
- `npm run dev:pages:stop` (stop stale local wrangler/workerd processes on port `8788`)

Legacy stack (not production-like path):
- `npm run dev:all:legacy` (Express + Vite + Python AI sidecar + Ollama)

## Notes

- Cloudflare Pages does not bundle the large `data/*` snapshot files because
  the deployed app should use Pages Functions + D1 and Pages enforces a 25 MiB
  per-file upload limit.

# Cloudflare Pages Auth Setup

## Required Environment Variables

- VITE_AUTH0_DOMAIN
- VITE_AUTH0_CLIENT_ID

## Setup Notes

- The active frontend admin flow uses Auth0, not the legacy Pages-native GitHub
  auth routes in `cloudflare-pages/functions/api/auth/github/*`.
- Set Auth0 values through the GitHub Actions frontend build variables.
- Only /admin is protected; public search stays open.
- For local dev, use VITE_API_URL to point frontend to your backend.
