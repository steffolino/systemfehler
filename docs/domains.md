# Domain Design in systemfehler

## Overview

The project is structured around **domains**, each representing a type of content:

- `benefits` – Sozialleistungen, Jobcenter-Hilfen, Bürgergeld etc.
- `tools` – Digital or physical tools that help with access or resistance
- `aids` – Unterstützungsangebote, NGOs, Solinetze
- `news` – Press articles, legislation updates, action alerts
- `guides` – Step-by-step instructions, explainer content
- `topics` – Thematic aggregations or tags

Each domain defines:
- Data source types
- Extraction/crawler logic
- Schema conventions (but always LLM-ready JSON)

---

## Current Domain Responsibilities

| Domain    | Description                        | Has Crawler | Data Exists |
|-----------|------------------------------------|-------------|-------------|
| benefits  | Government & NGO aid programs      | ✅          | ✅          |
| tools     | Tech/tools to fight exclusion      | ✅          | ✅          |
| aids      | Sozialberatung, Sozialkontakte     | 🚧          | partial     |
| news      | Policy news & press articles       | 🚧          | partial     |
| guides    | Schritt-für-Schritt Anleitungen    | 🚧          | ⛔️          |
| topics    | Keyword overlays (e.g. "Miete")    | —           | ✅ (meta)   |

---

## Domains can differ in:

- **Source types**: static, crawling, scraping, editorial
- **Update frequency**: one-time vs. daily sync
- **Moderation level**: trusted source vs. flagged vs. unknown
- **Language**: all domains support multilingual entries

