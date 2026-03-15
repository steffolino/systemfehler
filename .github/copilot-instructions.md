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
contributors to commands. For issue and docs reconciliation, also consult
`docs/current-state.md`.

---

## Current priorities (next work items)

Use `docs/current-state.md` plus `docs/status.md` before prioritizing work.

Based on the live repo and open issues, the highest-value areas are:

1. **Issue reconciliation**
   - review and likely close or rewrite stale open issues such as `#6`, `#18`,
     and `#28`
   - merge duplicate issue pairs such as `#45/#46` and `#85/#86`
2. **Investigation/source workflow track**
   - focus on issues `#63-#86`, which define the current product expansion:
     source submission, validation, evidence linking, reviewer queues, and
     dashboard support
3. **AI roadmap hardening**
   - issues `#44-#60` remain active; treat the AI gateway and helper modules as
     partial scaffolding unless `docs/status.md` says otherwise
4. **Documentation drift cleanup**
   - keep contributor-facing docs aligned with the Python-first crawler model
     and Cloudflare Pages as the primary deployment target

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
