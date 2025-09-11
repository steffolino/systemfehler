# systemfehler Workflow

**Digital tools for radical access: countering the failure of the welfare state with open-source solidarity.**

This document describes the canonical workflow for the systemfehler project - from data collection to user interface.

---

## Overview

The systemfehler project follows a linear pipeline workflow:

**crawl → parse → ingest → API → frontend**

This workflow enables us to collect, structure, and serve information about welfare benefits, tools, and resources through an accessible web interface.

---

## Core Workflow Components

### 1. Crawl (services/scrapy_crawler/)
Python-based scrapers collect data from various sources:
- **benefits_spider.py** - Government welfare programs
- **tools_spider.py** - Digital and physical tools for accessibility
- **contacts_spider.py** - Support organizations and contacts
- **aid_spider.py** - Additional aid programs
- **meta_spider.py** - Metadata and reference information

Crawlers output structured JSON data to `data/{domain}/entries.json`.

### 2. Parse & Structure (data/)
Structured data organized by domain:
- `data/benefits/entries.json` - Welfare benefits and programs
- `data/tools/entries.json` - Accessibility tools and resources
- `data/contacts/entries.json` - Support organizations
- `data/aid/entries.json` - Additional aid programs
- `data/meta/` - Metadata (slogans, topics, etc.)

All entries follow consistent schema conventions for multilingual support and LLM compatibility.

### 3. Ingest (services/ingest/)
The ingest service processes JSON data and prepares it for database storage:
- Validates data schema
- Normalizes entries
- Handles migrations and updates

### 4. API Layer
Two API implementations serve the processed data:

**Local API (services/api/)**
- Express.js application 
- SQLite database for local development
- REST endpoints for all data domains

**Production API (api/)**
- Cloudflare Worker implementation
- Cloudflare D1 database
- Optimized for serverless deployment

### 5. Search (services/search/)
Python-based search service providing:
- Full-text search across all domains
- Filtering and faceted search
- Search relevance scoring

### 6. Frontend (apps/fe/)
Nuxt 3 application providing the user interface:
- Accessible, multilingual design (German/English)
- TailwindCSS + DaisyUI styling with custom themes
- Server-side rendering for performance
- Responsive design for mobile accessibility

---

## Development Workflow

### Local Development Setup
```bash
# Start all services with Docker
docker-compose -f docker-compose.yml up --build

# OR run frontend locally
cd apps/fe
pnpm install
pnpm dev
```

### Data Update Workflow
1. Run crawlers: `python services/scrapy_crawler/run_all_spiders.py`
2. Process data: Run ingest service to update database
3. Deploy: Push changes trigger automatic deployments

### Core Directories
- `services/scrapy_crawler/` - Python crawlers
- `services/ingest/` - Data ingestion logic  
- `services/search/` - Search functionality
- `services/api/` - Local Express API
- `api/` - Cloudflare Worker API
- `apps/fe/` - Nuxt frontend application
- `data/` - Structured JSON data
- `scripts/` - Database seeding and utility scripts
- `migrations/` - Database migration files

---

## Domain-Driven Design

Each domain (benefits, tools, contacts, aid) is independently structured:
- Own crawler pipeline
- Own data files in `data/{domain}/`
- Shared schema conventions
- Multilingual support (`lang`, `title`, `description`)
- Consistent metadata (tags, topics, sources)

---

## Configuration Files

Essential configuration maintained:
- `package.json` / `pnpm-lock.yaml` - Node.js dependencies
- `docker-compose.yml` - Local development orchestration
- `wrangler.toml` / `wrangler.worker.toml` - Cloudflare deployments
- `tsconfig.json` - TypeScript configuration
- `.gitignore` - Repository hygiene

---

## See Also

- [README.md](./README.md) - Project overview and quick start
- [LICENSE](./LICENSE) - GNU AGPLv3 licensing terms