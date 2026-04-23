# Life-Events Retrieval (Local-first)

This document describes the life-events retrieval strategy used by guided search.

## Goal

Map user situations to retrieval context before ranking:

- detect likely life event from query
- expand query with event-specific terms
- restrict to relevant domains
- boost event-relevant evidence

## Current life-event context input

Users can select a life-event context in the frontend (guided mode).  
The frontend sends `life_event` to `/api/ai/retrieve` and `/api/ai/synthesize`.

If no explicit context is selected, the backend auto-detects likely scenarios.

## Scenario source (runtime)

Domain experts curate scenario definitions in:

- `data/_topics/life_events.json`

Pages deploy now ships this file as a static asset at:

- `/data/_topics/life_events.json`

Runtime retrieval loads this file via `env.ASSETS` (with cache) and applies:

- detection keywords and expansions
- domain focus
- scenario-specific ranking boosts/penalties
- per-scenario resource targets (`documents`, `information`, `contacts`)
- contact-priority hints for assistive contact ranking

Scenario processing implementation:

- `cloudflare-pages/functions/api/_lib/ai.js`

## Local evaluation and regression

Run scenario-aware retrieval checks locally:

```bash
node scripts/eval_guided_retrieval_local.mjs
node scripts/eval_guided_retrieval_local.mjs --life-event upskilling --query "Wie kann ich mich weiterbilden?"
node scripts/eval_guided_retrieval_local.mjs --gold --fail-on-regression
```

Default eval prints:

- detected/forced stages
- domain focus
- expansion terms
- top ranked local results

Gold mode (`tests/fixtures/life_event_gold_queries.json`) prints:

- per-query pass/fail
- per-check pass/fail
- aggregate case/check pass rates

Use `--fail-on-regression` in CI to return non-zero on failed cases.

The suggested-queries fixture covers all 20 scenarios (3 queries each = 60 cases):

```bash
# Run suggested-queries suite (broader coverage, 60 cases)
node scripts/eval_guided_retrieval_local.mjs --gold tests/fixtures/life_event_suggested_queries.json

# Run both suites back-to-back
node scripts/eval_guided_retrieval_local.mjs --gold --fail-on-regression
node scripts/eval_guided_retrieval_local.mjs --gold tests/fixtures/life_event_suggested_queries.json --fail-on-regression
```

## Eval fixture status (as of 2026-04-23)

| Fixture | Cases | Checks | Status |
|---|---|---|---|
| `life_event_gold_queries.json` | 4/4 (100%) | 24/24 (100%) | ✅ baseline |
| `life_event_suggested_queries.json` | 60/60 (100%) | 255/255 (100%) | ✅ green |

## How the local retrieval pipeline works

Entries are loaded from `data/*/entries.json` (benefits, aid, contacts, tools, organizations).
The scorer uses `title + summary + content + url + topics + tags` as a text blob for term matching.
Expected terms in fixtures must appear in the top-k entry titles or URLs to pass.

Key files:
- **Entry data:** `data/{benefits,aid,contacts,tools,organizations}/entries.json`
- **Scenarios + detection keywords:** `data/_topics/life_events.json`
- **Resource packs:** `data/_topics/life_event_resource_packs.json`
- **Scorer/ranker:** `cloudflare-pages/functions/api/_lib/ai.js` → `localEvaluateEntries()`
- **Gold fixture:** `tests/fixtures/life_event_gold_queries.json`
- **Suggested-queries fixture:** `tests/fixtures/life_event_suggested_queries.json`
- **Seeding script:** `scripts/add_weak_scenario_entries.mjs`

## German umlaut normalisation

`inferUserStageContext()` and `scoreEntry()` in `ai.js` pass the query through
`normalizeGermanChars()` before comparing against detection keywords and scenario
term boosts:

```
ä → ae   ö → oe   ü → ue   ß → ss
```

This ensures queries like *"Bürgergeld"*, *"Höhe"*, *"Für"* consistently hit
scenario keywords written in ASCII form (`buergergeld`, `hoehe`, etc.).
Keywords in `life_events.json` must be written in their normalised form.

## Bürgergeld and Regelbedarf coverage

The `job_loss_start` scenario detects the following Bürgergeld-specific keywords
(after umlaut normalisation):

```
buergergeld hoehe  ·  wie hoch buergergeld  ·  buergergeld berechnen
wie viel buergergeld  ·  anspruch buergergeld  ·  buergergeld antrag
regelbedarf  ·  regelleistung
```

The `low_income_topup` scenario also detects `regelbedarf`, `regelleistung`, and
`grundsicherungsbetrag`, and uses a `relevance_guard.required_any` check to ensure
only entries related to income supplementation appear in its ranked output.

## Scenario relevance guards

Some scenarios use `relevance_guard` in `life_events.json` to pre-filter irrelevant entries
before scoring. This prevents co-detected scenarios from polluting the ranked results:

- `job_loss_start` — blocks kindergeld/pflegegrad noise
- `low_income_topup` — requires regelbedarf/regelleistung/grundsicherung match
- `recognition_missing` — blocks debt/family noise
- `mental_burnout` — requires psych/health terms so debt-crisis co-detection doesn't dominate

## Next steps

1. **Add BA PDF sources for remaining scenarios** — Pflegeversicherung, DRV Reha, BAMF
   integration brochures are not yet in the RAG source registry. Use `download-page` + register
   in `data/_rag_sources/source_registry.json` for full RAG coverage.
2. **Widen gold fixture** — promote the best suggested-queries cases into
   `life_event_gold_queries.json` as new hard regression tests.
3. **Contact entries for migration/residence** — the contacts domain is heavy on generic
   Caritas/Diakonie entries; add specific BAMF-Navi and Flüchtlingsrat entries with
   scenario-targeted titles.
4. **`--fail-on-regression` in CI** — wire both fixture runs into the CI pipeline.
