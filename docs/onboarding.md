# Developer Onboarding – Systemfehler

## 1. Overview

Systemfehler is a data infrastructure project for social services. It focuses on:

- Collecting and normalizing information from heterogeneous public sources.
- Preserving information even when it is removed from the original websites.
- Tracking temporal changes, deadlines, and discontinuations.
- Providing structured, multilingual, LLM-ready data.

This document explains how to get started as a developer.

---

## 2. Prerequisites

- Git and GitHub account.
- Node.js (LTS) and npm or pnpm.
- Recommended:
  - VS Code with GitHub extension.
  - GitHub CLI (`gh`) for managing issues and PRs.
  - A recent version of `node` that supports modern ES modules.

Optional but useful:

- Python for additional crawling and data processing scripts.
- Pandoc or similar tools if you want to generate PDFs from markdown.

---

## 3. Repository Layout (High Level)

Key directories:

- `data/`
  - Schemas, taxonomies, and the actual entries for each domain.
- `services/`
  - Domain-specific crawlers and shared crawling utilities.
- `moderation/`
  - Moderation queue, audit log, and dashboard.
- `scripts/`
  - Validation, diff generation, scoring, and reporting utilities.
- `docs/`
  - Project documentation (architecture, onboarding, vision, diagrams).
- `README.md`
  - High-level project overview.

Refer to `docs/architecture.md` for a detailed description.

---

## 4. Core Concepts

### 4.1 Schema-Driven Data

Entries are defined by:

- A core schema (common fields).
- Domain-specific extension schemas.
- Taxonomies for topics, tags, and target groups.

All entries in `data/<domain>/entries.json` are expected to validate against these schemas.

You should not modify entries without running validation.

### 4.2 Domains

Initial domains include:

- `benefits`
- `aid`
- `tools`
- `organizations`
- `contacts`

Each domain can be extended over time. New domains can be added if they follow the same architectural pattern.

### 4.3 Crawlers

Crawlers live under `services/<domain>/crawler/`. They:

- Load URLs from `data/<domain>/urls.json`.
- Fetch and parse pages.
- Extract candidate data into normalized objects.
- Pass candidate data to the diff and moderation pipeline.

A shared base module under `services/_shared/` provides common functionality such as HTTP fetching, error handling, URL normalization, and logging.

### 4.4 Moderation and Audit

No crawler writes directly into `entries.json`.

Instead:

- New or updated entries are written into `moderation/review_queue.json` together with their diffs.
- Moderators review and approve or reject changes (using the dashboard).
- Approved changes update `data/<domain>/entries.json`.
- All actions are logged in `moderation/audit_log.jsonl`.

### 4.5 Temporal and Multilingual Aspects

Entries include:

- Validity and deadlines (e.g. `validFrom`, `validUntil`, `deadline`, `status`).
- Multilingual text (e.g. `de`, `en`, `easy_de`).
- Preservation of translations even when removed from the source.

These aspects are critical and must be respected in all changes.

---

## 5. Local Setup

1. Clone the repository:

   ```bash
   git clone git@github.com:steffolino/systemfehler.git
   cd systemfehler
   ```

2. Install dependencies (example):

   ```bash
   npm install
   ```

3. Run validation to ensure everything is consistent:

   ```bash
   npm run validate
   ```

4. Run an example crawler (depending on implementation):

   ```bash
   npm run crawl:benefits
   ```

5. Inspect the moderation queue:

   * Open `moderation/review_queue.json`.
   * Verify that new items contain proposed data, current data, and diffs.

---

## 6. Typical Development Workflow

1. **Pick an issue**

   * Use GitHub issues (Epics + atomic issues).
   * Assign yourself to an issue.

2. **Create a feature branch**

   ```bash
   git checkout -b feature/short-description
   ```

3. **Implement changes**

   * For schema work: modify files in `data/_schemas/` and update documentation.
   * For crawler work: adjust `services/<domain>/crawler/` and/or configuration.
   * For moderation/dashboard: update files under `moderation/` and `scripts/`.

4. **Run checks**

   * Validate data:

     ```bash
     npm run validate
     ```

   * Run tests (if present):

     ```bash
     npm test
     ```

5. **Commit and push**

   ```bash
   git commit -am "Short, descriptive message"
   git push origin feature/short-description
   ```

6. **Open a Pull Request**

   * Reference the relevant GitHub issue.
   * Describe what changed and why.
   * Indicate any schema or data migrations if needed.

---

## 7. Guidelines and Conventions

* Keep schemas backward compatible whenever possible.
* Use descriptive and consistent naming for fields and functions.
* Do not bypass moderation: crawlers should never write directly into final entries.
* Document new scripts and workflows under `docs/` when they affect contributors.
* Use taxonomies for classification, do not invent new ad hoc labels without coordination.
* Changes in schemas should be accompanied by:

  * Version bumps.
  * Changelog entries.
  * Updated validation logic.

---

## 8. Where to Start

Recommended first tasks for new contributors:

* Read `docs/architecture.md` once end-to-end.
* Explore an existing domain (e.g. `data/benefits/entries.json` and its corresponding crawler).
* Run validation and one crawler locally.
* Pick a small issue related to:

  * Documentation,
  * Validation rules,
  * Taxonomy definitions, or
  * A minor extension to the moderation dashboard.

Once you are comfortable with the workflow, you can move on to more complex tasks such as adding domains, improving scoring, or extending the temporal modeling.
