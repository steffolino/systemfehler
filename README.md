# Systemfehler

Systemfehler is a modular, extensible, preservation-oriented data platform for social services in Germany. It collects, normalizes, and preserves information about benefits, aid programs, tools, organizations, and related support structures.

The goal is to make information about social rights and support more transparent, accessible, and robust against removal or silent change.

---

## Features

- **Modular domain structure**

  Each domain (e.g. benefits, aid, tools, organizations, contacts) has its own crawler and data files, following a common pattern.

- **Schema-driven data**

  A core schema defines stable, cross-domain fields. Extension schemas capture domain-specific fields. All entries are validated against these schemas.

- **Temporal modeling**

  Entries contain temporal fields (e.g. validity intervals, deadlines, status). Historical versions are archived, so changes over time remain observable.

- **Multilingual support**

  Text fields support multiple languages (initially German, English, and Easy German). Translations are preserved even if removed from the original sources.

- **Human-in-the-loop moderation**

  Crawler output is never published directly. All changes go into a moderation queue, with diffs and provenance information. Moderators approve or reject changes, and an audit log records decisions.

- **Quality and AI searchability scores**

  Entries receive Information Quality and AI Searchability scores to help detect incomplete or outdated data and support downstream ranking and analysis.

- **LLM-ready structure**

  Data is stored in a structured, explicit format that supports retrieval-augmented generation, question answering, and future AI-based advisory tools.

---

## Repository Structure

A typical layout looks like this:

```text
data/
  _schemas/
  _taxonomy/
  _sources/
  _quality/
  benefits/
  aid/
  tools/
  organizations/
  contacts/

services/
  benefits/
  aid/
  tools/
  organizations/
  contacts/
  _link_expander/
  _shared/

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
```

For details, see `docs/architecture.md`.

---

## Getting Started

### Prerequisites

* Git and GitHub account.
* Node.js (LTS) and npm or pnpm.
* Recommended: VS Code and GitHub CLI (`gh`).

### Installation

```bash
git clone git@github.com:steffolino/systemfehler.git
cd systemfehler
npm install
```

### Basic Commands

The exact scripts may differ depending on implementation, but a typical workflow could be:

```bash
# Validate entries against schemas and taxonomies
npm run validate

# Run a domain-specific crawler (example: benefits)
npm run crawl:benefits

# Recalculate quality scores
npm run score

# Generate temporal and language reports
npm run report:temporal
npm run report:languages
```

Refer to `package.json` once implemented for the authoritative list of scripts.

---

## Architecture and Design

For a detailed description of the architecture, see:

* `docs/architecture.md` – architectural overview and data flow.
* `docs/blueprint.md` – system diagrams (PlantUML and Mermaid).
* `docs/vision.md` – strategic and stakeholder-focused overview.

---

## Contributing

1. Check open issues in GitHub and pick an Epic or sub-issue that matches your interests.
2. Create a feature branch and implement changes in a small, focused scope.
3. Run validation and any relevant scripts before committing.
4. Open a Pull Request and describe:

   * What changed.
   * Which issue(s) it closes.
   * Any schema updates or data migrations.

Guidelines:

* Do not bypass moderation: crawlers should never write directly into final entries.
* Keep schemas backward compatible where possible and update schema versioning and changelogs when changes are made.
* Update documentation under `docs/` if changes affect other contributors.

---

## License

To be defined. Until then, please consider the repository as "all rights reserved" by the project owner, unless a license file is added specifying otherwise.

---

## Status

Systemfehler is under active design and early implementation. The architecture and documentation are intended to support incremental development while keeping long-term goals and data integrity in focus.
