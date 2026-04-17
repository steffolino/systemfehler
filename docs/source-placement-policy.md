# Source Placement Policy
_Last updated: 2026-04-17_

This policy defines where each information type belongs in Systemfehler's hybrid model.

## Goal

Keep answers both:

- correct and auditable (official/legal authority), and
- actionable for users (real support pathways).

## Hybrid Model

Systemfehler uses three evidence classes:

1. Official / normative
2. NGO / support-practical
3. Contextual / discovery-only

Do not merge these classes into one trust bucket.

## Placement Rules

1. Official legal truth

- Includes statutes, court decisions, official rule guidance, official forms.
- Place in: `data/_rag_sources/source_registry.json`
- Use trust tiers: `tier_1_law` or `tier_2_official`.
- Purpose: primary answer grounding.

2. Actionable support information

- Includes counseling access, support directories, contact routes, practical "what can I do now?" paths.
- Place in: topic-guided seed pipeline via `data/_topics/trusted_topic_sources.json`.
- Primary topic: `hilfe_beratung_unterstuetzung`.
- Typical roles: `ngo_support_source`, `meta_support_portal_source`.
- Target domains: mainly `aid`, `contacts`, and `tools` for finder-style services.

3. Templates / musterschreiben / practice aids

- Includes non-binding but practically useful sample letters and process aids.
- Place in: `aid` topic seeds first.
- Promote to RAG corpus only after stability and quality checks (avoid volatile pages in primary legal evidence).

4. Contextual and news-like sources

- Includes commentary, political framing, journalism-like updates, high-volatility pages.
- Place in: discovery roles only (for crawl expansion and background context), lower priority.
- Do not let these outrank official legal evidence.

## Trust and Ranking Behavior

- Official legal evidence remains top-ranked for normative claims.
- NGO/support evidence is preferred when the user intent is procedural help, contact finding, or support access.
- If sources conflict, present conflict explicitly rather than flattening into one answer.

## Domain Mapping

- `benefits`: official rules, eligibility, legal baseline.
- `aid`: practical support, advisory pathways, NGO help content, selected templates.
- `contacts`: institutions, hotlines, counseling entry points, service finders.
- `tools`: calculators, finders, application entry points.
- `organizations`: provider metadata, network context.

## Seed Quality Gate

Before adding a URL to trusted topic seeds:

1. Reachability check (HTTP 2xx/3xx expected).
2. Signal check: URL/path indicates support intent (`beratung`, `hilfe`, `kontakt`, `schuldner`, etc.).
3. Noise check: exclude imprint/privacy/news archive/tag pages.
4. Stability check: prefer evergreen service pages over temporary campaign/news pages.

Sitemap-first discovery is recommended, followed by lightweight manual curation.

## Operational Workflow

1. Register source in `data/_sources/registered_sources.json`.
2. Add topic role + `seedUrls` in `data/_topics/trusted_topic_sources.json`.
3. Sync seeds via `python crawlers/cli.py sync-topic-seeds --domain <domain>`.
4. Crawl seeded domains and inspect `crawl_metrics.json`.
5. Promote candidates only through quality-filtered promotion pipeline.

## Non-Goals

- This policy does not replace legal review.
- This policy does not assert legal bindingness of NGO material.
- This policy does not force all support pages into RAG primary corpus.
