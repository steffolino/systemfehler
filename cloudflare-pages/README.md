Cloudflare Pages read-only API

This folder contains Cloudflare Pages Functions that serve a read-only API from the repository's JSON snapshots.

Endpoints:
- `/.netlify/functions/api/data/entries` -> list entries (query: `domain`, `limit`, `offset`, `includeTranslations`)
- `/api/data/entries/:id` -> single entry by id
- `/api/data/moderation-queue` -> moderation queue from `moderation/review_queue.json`
- `/api/health` -> health

To deploy, see the GitHub Actions workflow at `.github/workflows/deploy-pages.yml` and set the required Secrets:
- `CF_PAGES_API_TOKEN`
- `CF_ACCOUNT_ID`
