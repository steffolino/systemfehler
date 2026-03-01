# Synthetic and Placeholder Data Inventory

This document tracks non-production data artifacts that are intentionally present in the repository.

Last reviewed: 2026-03-01

## Replaced During Audit

- `moderation/review_queue.json`
  - Previous state contained synthetic moderation items referencing `example.org`.
  - Current state is reset to an empty queue (`[]`).

- `data/tools/entries.json`
  - Previous state contained synthetic `example.org` tool entry and malformed duplicate JSON blocks.
  - Current state is normalized to empty entries with explicit placeholder metadata.

- `data/benefits/urls.json`
- `data/aid/urls.json`
- `data/tools/urls.json`
- `data/organizations/urls.json`
- `data/contacts/urls.json`
  - Previous state: empty placeholder seed files.
  - Current state: populated with real official federal source URLs.

## Remaining Placeholder Data (Visible, Not Yet Replaced)

- `data/pilot_translated.json`
  - Purpose: translation pilot format-reference artifact.
  - Current state: `samples` is empty and synthetic example records were removed.
  - Visibility marker: `meta.syntheticData: true` and explanatory `meta.note`.

- `data/benefits/entries.json`
- `data/aid/entries.json`
- `data/tools/entries.json`
- `data/organizations/entries.json`
- `data/contacts/entries.json`
  - Purpose: empty domain snapshots pending moderated crawl ingestion.
  - Visibility marker: `_todo` replacement tasks (and `_meta.placeholder` for tools entries).

## Suggested Production Gate

Before any public or production release:

1. `data/*/urls.json` should have `urls.length > 0` or be explicitly excluded.
2. `data/*/entries.json` should either:
   - contain validated real entries, or
   - be flagged as intentionally empty for that release.
3. `data/pilot_translated.json` should be excluded from production packaging, or removed once superseded.
4. `moderation/review_queue.json` should contain only real moderation events from live workflows.
