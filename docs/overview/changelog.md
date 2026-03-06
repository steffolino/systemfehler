# Overview Changelog

## 2026-03-06

- Finalized Cloudflare Pages deployment path with working Functions routing for `/api/*`.
- Added D1-backed API parity endpoints on Cloudflare Pages (`/api/status`, `/api/data/quality-report`) and Worker-safe moderation queue handling.
- Expanded D1 schema with `moderation_queue` and applied schema remotely.
- Fixed frontend API base-path normalization to prevent duplicate `/api/api/*` requests.
- Enabled `Crawl and Ingest` end-to-end by documenting required secrets and hardening `scripts/ingest_to_d1.py` (supports both array snapshots and `{ "entries": [...] }`, includes explicit ingest User-Agent).

## 2026-03-01

- Published validated real snapshot data for all five domains (`benefits`, `aid`, `tools`, `organizations`, `contacts`): 25 entries total (5 per domain).
- Fixed static production data access by switching frontend snapshot reads to same-origin GitHub Pages paths and packaging snapshot JSON into the deployment artifact.
- Completed GitHub Pages workflow hardening (workflow source mode, resilient moderation queue packaging).
- Enriched German summaries/content across real entries and kept validation clean (`npm run validate` => 0 errors, 0 warnings).
- Refreshed core documentation to reflect current live architecture, deployment model, and data status.
