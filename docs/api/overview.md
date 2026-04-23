# API Overview
_Last updated: 2026-03-15_

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

## Deployment notes

- Primary production target: Cloudflare Pages

For the detailed request and response reference, see `docs/api.md`.
