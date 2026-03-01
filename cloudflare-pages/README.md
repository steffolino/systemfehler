Cloudflare Pages deployment

This folder contains Cloudflare Pages Functions for a read-only API that serves
JSON snapshots from the repository.

Current production frontend hosting is GitHub Pages. Cloudflare deployment remains available as an optional alternative path.

The deployment workflow builds the frontend app from `frontend/` and deploys:
- static site: `frontend/dist`

Pages Functions source remains in `cloudflare-pages/functions` and can be wired
in a dedicated API deployment step.

## API Endpoints

- `/api/data/entries` -> list entries (`domain`, `limit`, `offset`, `includeTranslations`)
- `/api/data/moderation-queue` -> moderation queue from `moderation/review_queue.json`
- `/api/health` -> health check

## Required GitHub Secrets

Set these in repository settings (`Settings -> Secrets and variables -> Actions`):

- `CF_PAGES_API_TOKEN`
- `CF_ACCOUNT_ID`

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
