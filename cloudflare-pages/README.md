Cloudflare Pages deployment

This folder contains Cloudflare Pages Functions for a D1-backed API used by the
frontend when deployed to Cloudflare Pages.

Current production frontend + API hosting is Cloudflare Pages. GitHub Pages remains available as a static fallback path.

The deployment workflow builds the frontend app from `frontend/` and deploys:
- static site: `frontend/dist`
- Pages Functions from `cloudflare-pages/functions` (via `wrangler pages deploy --cwd=cloudflare-pages`)
- bundled same-origin snapshot fallback assets copied into the deploy artifact:
  - `data/*`
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

## Required GitHub Secrets

Set these in repository settings (`Settings -> Secrets and variables -> Actions`):

- `CF_PAGES_API_TOKEN`
- `CF_ACCOUNT_ID`

For automated D1 ingest from `.github/workflows/crawl-and-ingest.yml`:

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

## Deployment Trigger

Deployment runs from `.github/workflows/deploy-pages.yml` on:
- pushes to `main`
- manual workflow dispatch

## Notes

- GitHub Pages workflow: `.github/workflows/deploy-github-pages.yml`
- Cloudflare Pages workflow now also bundles same-origin snapshot JSON and the
  moderation queue into the Pages artifact, mirroring the GitHub Pages fallback
  behavior.
- GitHub Pages serves same-origin snapshot JSON from `/data/*` and `/moderation/review_queue.json` inside the static artifact.

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
