Cloudflare Pages deployment

This folder contains Cloudflare Pages Functions for a D1-backed API used by the
frontend when deployed to Cloudflare Pages.

Current production frontend hosting is GitHub Pages. Cloudflare deployment remains available as an optional alternative path.

The deployment workflow builds the frontend app from `frontend/` and deploys:
- static site: `frontend/dist`
- Pages Functions from `cloudflare-pages/functions` (via `wrangler pages deploy --cwd=cloudflare-pages`)

## API Endpoints

- `/api/health` -> health check
- `/api/status` -> aggregated stats for dashboard cards
- `/api/data/entries` -> list entries (`domain`, `status`, `search`, `limit`, `offset`, `includeTranslations`)
- `/api/data/entries/:id` -> single entry
- `/api/data/moderation-queue` -> moderation queue from D1 table `moderation_queue`
- `/api/data/quality-report` -> quality metrics + missing translation report

## Required GitHub Secrets

Set these in repository settings (`Settings -> Secrets and variables -> Actions`):

- `CF_PAGES_API_TOKEN`
- `CF_ACCOUNT_ID`

For automated D1 ingest from `.github/workflows/crawl-and-ingest.yml`:

- `PAGES_INGEST_URL` (e.g. `https://systemfehler.pages.dev`)
- `INGEST_TOKEN` (must match the Cloudflare Pages secret `INGEST_TOKEN`)

## Cloudflare Project Setup

1. Create a Cloudflare Pages project named `systemfehler`.
2. You do not need to configure Cloudflare-side build commands if using the GitHub Actions deploy workflow.
3. Ensure production branch is `main`.

## Deployment Trigger

Deployment runs from `.github/workflows/deploy-pages.yml` on:
- pushes to `main`
- manual workflow dispatch

## Notes

- GitHub Pages workflow: `.github/workflows/deploy-github-pages.yml`
- GitHub Pages serves same-origin snapshot JSON from `/data/*` and `/moderation/review_queue.json` inside the static artifact.
