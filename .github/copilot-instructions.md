# Copilot Instructions for Systemfehler

These instructions help GitHub Copilot Chat provide accurate, consistent
suggestions for this repository.

---

## Python-first crawling pipeline

**Python `crawlers/` is the canonical implementation for all crawling,
diff generation, and schema validation steps.**

- When suggesting crawler code, use Python (`crawlers/shared/base_crawler.py`
  as the base class).
- Do **not** add runtime crawling logic to the Node.js stubs under
  `services/*/crawler/`. Those files are reference-only design scaffolding.
- Do **not** duplicate crawler logic in Node.js. If a Node script needs to
  trigger a crawl, call the Python CLI via `child_process.execFile` or a
  shell wrapper.

### Python CLI commands (authoritative)

```bash
# Run the benefits crawler
python crawlers/cli.py crawl benefits --source arbeitsagentur

# Validate entries for a domain
python crawlers/cli.py validate --domain benefits

# Import entries to PostgreSQL
python crawlers/cli.py import --domain benefits --to-db
```

---

## Canonical repo state

See `docs/status.md` for the definitive, up-to-date picture of:

- What is implemented vs stubbed
- Schema locations and validation instructions
- Moderation storage modes (file vs DB)
- Commands expected to work today
- Planned next work items

Always consult `docs/status.md` before adding new features or pointing
contributors to commands.

---

## Current priorities (next work items)

Based on open issues, these are the next areas to tackle in priority order:

1. **Moderation workflow / diff alignment** – align `moderation/review_queue.json`
   format with the `moderation_queue` DB table so both paths are interchangeable
   (MOD-01, issue #18).
2. **Canonical moderation queue format** – document and enforce a single schema
   for queue entries regardless of storage backend.
3. **TIME-03 duplicate cleanup** – remove or merge the duplicate time-related
   entry (see issue tracker).
4. **Python crawlers for additional domains** – `aid`, `tools`, `organizations`,
   `contacts` do not have Python crawlers yet; follow the pattern in
   `crawlers/benefits/arbeitsagentur_crawler.py`.
5. **Link expander** (CRAWL-03, issue #6) – planned Python implementation that
   scans pages for outgoing links and discovers new candidate URLs.

---

## Rules for contributions and suggestions

1. **Avoid duplicating crawler logic in Node.js.** Prefer Python wrappers or
   documentation. If a script truly needs to be in Node.js, delegate to the
   Python CLI via `child_process`.
2. **Keep `package.json` scripts consistent.** Working scripts call Python or
   Node backend code. Broken stubs print a clear message and exit non-zero
   rather than throwing an uncaught exception.
3. **Schemas are the contract.** All new data must validate against the JSON
   schemas in `data/_schemas/`. Use `npm run validate` or
   `python crawlers/cli.py validate` to check before committing.
4. **Moderation queue entries must include provenance.** Every candidate that
   reaches the queue must carry a `provenance` object with `crawledAt`,
   `source`, and `crawlerVersion`.
5. **Update `docs/status.md`** whenever the implementation status of any
   component changes.
