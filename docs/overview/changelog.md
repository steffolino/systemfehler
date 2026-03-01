# Overview Changelog

## 2026-03-01

- Published validated real snapshot data for all five domains (`benefits`, `aid`, `tools`, `organizations`, `contacts`): 25 entries total (5 per domain).
- Fixed static production data access by switching frontend snapshot reads to same-origin GitHub Pages paths and packaging snapshot JSON into the deployment artifact.
- Completed GitHub Pages workflow hardening (workflow source mode, resilient moderation queue packaging).
- Enriched German summaries/content across real entries and kept validation clean (`npm run validate` => 0 errors, 0 warnings).
- Refreshed core documentation to reflect current live architecture, deployment model, and data status.
