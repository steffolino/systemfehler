# Systemfehler Current State

_Last updated: 2026-03-15_

This document consolidates the repository's current reality across:

- live GitHub issues
- implemented code paths
- contributor-facing documentation

Use this file together with `docs/status.md` when deciding what is real,
what is legacy scaffolding, and what should be worked on next.

## Authoritative Sources

Treat these files as authoritative unless code proves otherwise:

- `docs/status.md`
- `README.md`
- `package.json`
- `cloudflare-pages/README.md`
- `frontend/README.md`

Treat these as reference or planning documents, not runtime truth:

- `docs/architecture.md`
- `docs/blueprint.md`
- `docs/ai-roadmap.md`
- `IMPLEMENTATION_SUMMARY.md`

## Runtime Truth

### Crawling and ingestion

- Python under `crawlers/` is the canonical crawling pipeline.
- `crawlers/cli.py` is the authoritative entrypoint for crawl, validate,
  import, and link expansion.
- Node files under `services/*/crawler/` and `services/_link_expander/`
  are reference-only stubs and should not receive runtime crawling logic.

### Delivery stack

- Cloudflare Pages is the primary production deployment target.
- GitHub Pages is a static fallback that serves bundled snapshot JSON.
- Local development can use:
  - Express in `backend/server.js`
  - the AI sidecar in `backend/ai_service/gateway.py`
  - the React/Vite app in `frontend/`

### Data and moderation

- `data/*/entries.json` remains the canonical file snapshot format.
- `moderation/review_queue.json` now has a canonical camelCase entry shape.
- Queue canonicalization and validation live in
  `crawlers/shared/moderation_queue.py`.

## Implemented Surfaces

High-confidence implemented areas confirmed in code:

- Python crawlers for `benefits`, `aid`, `tools`, `organizations`, `contacts`
- Python link expansion in `crawlers/shared/link_expander.py`
- schema validation pipeline in `scripts/validate_entries.js`
- canonical moderation queue helpers in `crawlers/shared/moderation_queue.py`
- Express API in `backend/server.js`
- Cloudflare Pages Functions API in `cloudflare-pages/functions/api`
- React frontend and admin shell in `frontend/src`
- Admin raw-entry review now includes structured metadata-enrichment suggestions (`topics`, `tags`, `target_groups`, `keywords`) from the AI sidecar for editor review
- URL canonicalization helpers in `services/_shared/url_normalization.js`
- URL canonicalization tests in `tests/url_canonicalization_test.js`

Important verification finding:

- During reconciliation on 2026-03-15, validation briefly exposed a data/schema
  mismatch caused by legacy multilingual `title` objects in snapshot data.
- That mismatch has now been resolved by migrating snapshot entries to the
  canonical `title` string contract while preserving Easy German titles in
  `translations["de-LEICHT"]`.
- Current validation result: 25 entries, 0 schema/structural errors, 0 lint
  warnings.

Implemented but still mixed or incomplete:

- AI gateway scaffolding under `backend/ai_service/`
- RAG and LLM helper modules under `services/_shared/rag` and
  `services/_shared/llm`
- admin pages exist, but some moderation workflow pages are still placeholders
- temporal export scripts and several legacy reporting scripts remain stubs

## Open Issue Reconciliation

As of 2026-03-15, the public GitHub repository has 68 open issues. They fall
into three main groups.

### 1. Foundation issues still referenced by the repo

- `#6` CRAWL-03: cross-link detection
- `#7-#10`: schema and architecture baseline
- `#12-#15`: moderation, archival, multilingual, quality epics
- `#16-#33`: language, moderation, quality, temporal, crawling, export work
- `#39`: crawler test issue

### 2. AI roadmap issues

- `#44-#60`

These cover the LLM gateway, model routing, retrieval-first answers, evidence
handling, search assistance, moderation integration, telemetry, caching, and
safety rules.

### 3. Investigation and source-validation issues

- `#63-#86`

These define the newer investigation-oriented direction: authenticated
reviewers, source submissions, evidence models, provenance tracking, source
validation workflows, dashboard support, and investigation topics.

## Issue Status Assessment

### Likely stale or ready for review/closure

These open issues appear to have substantial code already in place and should
be manually reviewed against acceptance criteria:

- `#6` CRAWL-03
  - Python link expander exists and is marked working in `docs/status.md`.
- `#18` MOD-01
  - canonical moderation queue structure and validation helpers exist.
- `#28` DATA-05
  - validation pipeline is implemented in `scripts/validate_entries.js`.

### Likely partial, not fully done

- `#17` LANG-03
  - Easy German generation modules exist, but the full end-to-end reporting and
    operational workflow is not cleanly finished.
- `#30` CRAWL-06
  - URL canonicalization helpers and tests exist, but repo docs still describe
    this area as design work and integration is not clearly complete.
- `#44-#60`
  - AI infrastructure exists in scaffold form, but several items remain
    placeholder-grade or undocumented as production-ready.

### Clearly still open

- `#24-#26`
  - temporal export/archive/expiry work still contains explicit TODO stubs.
- `#31-#33`
  - extraction engine, merge strategy, and export summary work are still open.
- `#63-#86`
  - investigation/source workflow track is new and not reflected as complete in
    the current runtime code.

### Duplicate or near-duplicate candidates

- `#45` and `#46`
  - both are "Implement task-based LLM model routing policy".
- `#85` and `#86`
  - both cover building reliable non-governmental source and expertise
    networks, with very similar scope.

## Documentation Drift Found

The following docs were stale before this consolidation pass:

- `docs/onboarding.md`
  - pointed contributors at `services/<domain>/crawler/` as if it were active.
- `docs/architecture.md`
  - used `services/<domain>/crawler/` as the main crawler path in examples.
- `docs/api/overview.md`
  - documented an obsolete `/api/v1/` API shape.
- `docs/ai-roadmap.md`
  - referred to a `Nuxt` frontend even though the repo uses React/Vite.
- `.github/copilot-instructions.md`
  - listed priorities that no longer match `docs/status.md` or the live issue
    tracker.

## What To Trust When Making Changes

If a doc conflicts with code, use this order:

1. runtime code
2. `docs/status.md`
3. `docs/current-state.md`
4. `README.md`
5. planning/reference docs

## Recommended Cleanup Next

Highest-value housekeeping work:

1. Close or rewrite stale issues `#6`, `#18`, and `#28` after acceptance review.
2. Merge duplicate issues `#45/#46` and `#85/#86`.
3. Replace remaining legacy references to Node crawler runtime paths.
4. Decide whether the AI stack is experimental or supported, then document that
   explicitly in `docs/status.md`.
5. Audit placeholder admin pages and tag them as implemented shell vs working
   workflow.
