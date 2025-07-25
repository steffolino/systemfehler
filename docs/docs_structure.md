# Project Structure

This document explains the structure of the `systemfehler` repository.

## Root Modules

- `apps/` – Frontend applications (currently Nuxt 3 app)
- `services/` – Backend logic: crawlers, APIs, enrichers
- `data/` – Structured machine-readable JSON data
- `docs/` – Internal documentation (this folder)
- `docker-compose.yml` – Dev orchestration

---

## apps/frontend/

- Built with Nuxt 3 + Vue 3
- Uses TailwindCSS and `@nuxt/ui` for styling
- Internationalization (i18n) enabled
- Consumes data from JSON files and APIs
- Acts as the main user interface for tools, benefits, and guides

## services/crawler/

- Python-based scrapers
- One subfolder per domain (e.g. `benefits/`, `tools/`, `news/`)
- Crawlers store extracted JSON entries in `data/{domain}/entries.json`
- Modular and reusable (new sources = new script or plugin)

## services/api-tools/

- JSON-based API using FastAPI or Flask
- Serves enriched or filtered data to the frontend
- May later include search, suggestion, validation, and enrichment logic

## data/

- Organized by domain (`benefits/`, `tools/`, `aids/`, etc.)
- Each domain folder includes:
  - `entries.json`: main structured data
  - `urls.json`: known sources
  - `meta.json` (optional): update status, versioning
- Meant for both frontend consumption and LLM use

## docs/

- Markdown documentation: conventions, domains, usage
- Used for onboarding, architecture, and policy
