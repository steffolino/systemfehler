# API Overview
_Last updated: 2026-05-03_

Systemfehler currently exposes a read-oriented JSON API through two delivery
paths:

- Cloudflare Pages Functions in production
- the local Express server for development

There is no `/api/v1/` public API layer in the current repo.

## Current endpoint surface

Base path:

```text
/api/
```

Available endpoints:

| Endpoint | Description |
| --- | --- |
| `/api/version` | Runtime metadata and deployment target |
| `/api/health` | Health check |
| `/api/status` | Dashboard statistics |
| `/api/data/entries` | List entries with filtering and search |
| `/api/data/entries/:id` | Get one entry |
| `/api/data/moderation-queue` | List moderation queue items |
| `/api/data/quality-report` | Quality and translation report |
| `/api/data/life-event-review` | Life-event review cases and manual semantic overrides |
| `/api/ai/health` | Workers AI health and runtime config |
| `/api/ai/rewrite` | Query rewrite |
| `/api/ai/retrieve` | Retrieval evidence and diagnostics |
| `/api/ai/synthesize` | Retrieval-backed answer generation |
| `/api/ai/enrich` | Lightweight enrichment fallback |

## Deployment notes

- Primary production target: Cloudflare Pages
- Production retrieval validation is currently confirmed with a full
	suggested-query pass (`60/60`, run on 2026-05-03).

For the detailed request and response reference, see `docs/api.md`.
