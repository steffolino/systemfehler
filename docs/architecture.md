# Systemfehler – Architectural Overview

## 1. Purpose

Systemfehler is a modular, extensible, versioned platform for collecting, preserving, analyzing, and publishing information about social services in Germany.

The architecture supports:

- Continuous crawling and ingestion of heterogeneous sources
- Structured, schema-driven data preservation
- Temporal modeling and expiry tracking
- Multilingual content and accessibility requirements
- Human moderation and auditing
- LLM-readiness for search, classification, and explanation systems

The platform emphasizes data preservation, especially when public agencies modify or remove information.

---

## 2. Architectural Principles

### 2.1 Modularity

Each domain (e.g. benefits, aid, tools, organizations, contacts) functions as an independent module with its own data and crawler:

```text
services/<domain>/crawler/
data/<domain>/entries.json
data/<domain>/urls.json
```

This ensures clean separation of concerns and future extensibility.

### 2.2 Schema Extensibility

The schema architecture consists of:

* **Core schema**: stable, cross-domain fields.
* **Extension schemas**: domain-specific modules.
* **Versioning rules**: semantic versioning and changelogs.
* **Strict validation**: enforced via CI.

This allows the schema to evolve without breaking historical records.

### 2.3 Temporal Model

Each entry includes temporal fields such as:

* `validFrom`
* `validUntil`
* `deadline`
* `status` (e.g. `active`, `discontinued`, `archived`)
* `firstSeen`
* `lastSeen`
* `sourceUnavailable` (boolean)

This supports policy analysis, expiry detection, and historical reconstruction.

### 2.4 Multilingual Architecture

Text fields use structured language containers, for example:

```json
"title": {
  "de": "Titel auf Deutsch",
  "en": "Title in English",
  "easy_de": "Einfaches Deutsch"
}
```

Additional languages (e.g. `tr`, `ru`, `ar`) can be added as needed.

Translations are preserved even if they are later removed from the source.

### 2.5 Preservation-Oriented Crawling

Crawlers are designed to:

* Fetch and normalize pages from multiple sources.
* Detect and store outgoing links as potential new sources.
* Extract structured data using configurable rules.
* Detect missing translations or removed sections.
* Compare new data with existing entries and generate diffs.
* Never publish directly: all changes go through moderation first.

### 2.6 Moderation Workflow

Moderation queue entries include at least:

* Proposed new data.
* Existing stored data.
* A machine-generated diff.
* Provenance metadata (source, crawler, timestamps).
* Optional quality/scoring information.

Moderators approve, reject, or adjust changes. An audit log records all decisions and actions.

### 2.7 Quality and AI Searchability Scoring

Two scoring systems assess each entry:

* **Information Quality Score (IQS)** – measures completeness, freshness, provenance, and coverage of key fields.
* **AI Searchability Score (AIS)** – measures how well an entry can be used by information retrieval systems and LLMs (structure, clarity, language coverage, metadata richness).

Scores are computed by scripts and stored in a dedicated metadata block.

---

## 3. Repository Structure

A recommended high-level structure:

```text
systemfehler/
  data/
    _schemas/
      core.schema.json
      extensions/
        benefits.schema.json
        aid.schema.json
        tools.schema.json
        organizations.schema.json
        contacts.schema.json
    _taxonomy/
      topics.json
      tags.json
      target_groups.json
    _sources/
      registered_sources.json
      reliability.json
    _quality/
      scoring_rules.json
    benefits/
      entries.json
      urls.json
    aid/
      entries.json
      urls.json
    tools/
      entries.json
      urls.json
    organizations/
      entries.json
      urls.json
    contacts/
      entries.json
      urls.json

  services/
    benefits/
      crawler/
      extract/
      config/
    aid/
      crawler/
      extract/
      config/
    tools/
      crawler/
      extract/
      config/
    organizations/
      crawler/
      extract/
      config/
    contacts/
      crawler/
      extract/
      config/
    _link_expander/
      detect_links.js
    _shared/
      crawler_base.js
      url_normalization.js

  moderation/
    review_queue.json
    audit_log.jsonl
    dashboard/

  scripts/
    validate_entries.js
    generate_diff.js
    calculate_quality_scores.js
    export_temporal_view.js
    report_language_coverage.js

  docs/
    architecture.md
    onboarding.md
    vision.md
    blueprint.md

  README.md
```

This structure is indicative and can be refined as the implementation matures.

---

## 4. Data Flow Overview

1. **URL registration**

   * Source URLs are stored in `data/<domain>/urls.json`.

2. **Crawling and extraction**

   * Domain-specific crawlers in `services/<domain>/crawler/` fetch HTML.
   * Shared extraction and normalization logic converts HTML into candidates that match the core + extension schemas.

3. **Diff generation**

   * `scripts/generate_diff.js` compares candidate entries against existing entries in `data/<domain>/entries.json`.
   * Differences are captured as structured diffs.

4. **Moderation queue**

   * Proposed changes and diffs are written into `moderation/review_queue.json`.
   * Each entry contains old data, new data, diffs, and provenance.

5. **Moderation**

   * Moderators use a dashboard in `moderation/dashboard/` to review items.
   * Approved changes update the main entries files.
   * All actions are recorded in `moderation/audit_log.jsonl`.

6. **Scoring**

   * `scripts/calculate_quality_scores.js` computes IQS and AIS for each entry.
   * Scores are stored in a `qualityScores` block in the entry.

7. **Archival and temporal processing**

   * When services expire or change significantly, snapshots are stored in an archival structure (e.g. year-based directories or a dedicated snapshots file).
   * `scripts/export_temporal_view.js` creates time-based reports.

8. **Exports and external usage**

   * Additional scripts generate exports for external tools, APIs, or UIs.

---

## 5. Long-Term Stability and Evolution

Key mechanisms for long-term stability:

* **Schema versioning**: Every schema change increases the version and updates a schema changelog. CI enforces this.
* **Validation**: All entries are automatically validated against schemas and taxonomy lists.
* **Historical snapshots**: Old versions of entries are archived rather than overwritten.
* **Source reliability tracking**: Failures, removals, and structural changes in sources are monitored.
* **Taxonomy-based classification**: Topics, tags, and target groups are centrally managed and consistently used.
* **LLM-readiness**: Fields are explicit and structured, enabling future AI-based search and reasoning.

Systemfehler is designed as an evolving infrastructure. The architecture prioritizes extensibility and preservation so that it can adapt to future domains, legal changes, and technical requirements without losing historical context.
