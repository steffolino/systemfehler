# Systemfehler Setup Guide

This guide provides detailed instructions for setting up the Systemfehler data platform for local development.

Current baseline: all five domains are populated with real snapshot data
(25 entries total), and validation was re-verified on 2026-03-15 with
0 schema/structural errors and 0 lint warnings.

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Installation Steps](#installation-steps)
3. [Database Setup](#database-setup)
4. [Running Crawlers](#running-crawlers)
5. [Starting the API](#starting-the-api)
6. [Starting the Frontend](#starting-the-frontend)
7. [Troubleshooting](#troubleshooting)

---

## System Requirements

### Required Software

- **Node.js** 18.0.0 or higher
  - Download from https://nodejs.org/
  - Verify: `node --version`

- **Python** 3.11 or higher
  - Download from https://www.python.org/
  - Verify: `python --version` or `python3 --version`

- **PostgreSQL** 16 or higher
  - Download from https://www.postgresql.org/download/
  - Or use Docker (recommended for development)
  - Verify: `psql --version`

- **Git**
  - Download from https://git-scm.com/
  - Verify: `git --version`

### Optional Software

- **Docker** and **Docker Compose**
  - For running PostgreSQL in a container
  - Download from https://www.docker.com/

- **Python virtual environment tool**
  - `venv` (included with Python 3.3+)
  - Or `virtualenv`, `conda`, etc.

---

## Installation Steps

### 1. Clone the Repository

```bash
git clone https://github.com/steffolino/systemfehler.git
cd systemfehler
```

### 2. Install Node.js Dependencies

```bash
npm install
```

This installs backend dependencies including Express, pg, cors, etc.

### 3. Set Up Python Environment (Recommended)

Create a virtual environment to isolate Python dependencies:

```bash
# Create virtual environment
python3 -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows:
.\venv\Scripts\activate
```

### 4. Install Python Dependencies

```bash
pip install -r crawlers/requirements.txt
```

This installs:
- beautifulsoup4 (HTML parsing)
- requests (HTTP requests)
- lxml (fast XML/HTML parsing)
- python-dotenv (environment variables)
- jsonschema (schema validation)
- psycopg2-binary (PostgreSQL adapter)

### 5. Install Frontend Dependencies

```bash
cd frontend
npm install
cd ..
```

### 6. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` and configure:

```bash
# Database
DATABASE_URL=postgresql://systemfehler:dev_password@localhost:5432/systemfehler

# API
API_PORT=3001
NODE_ENV=development

# Crawlers
CRAWLER_USER_AGENT=Systemfehler/0.1.0 (+https://github.com/steffolino/systemfehler)
CRAWLER_RATE_LIMIT_DELAY=2000

# OpenAI (for existing LLM features - optional)
OPENAI_API_KEY=sk-your-api-key-here

# AI sidecar provider selection
# AI_PROVIDER=none|ollama|openai
AI_PROVIDER=none
AI_DEFAULT_MODEL=disabled
# Ollama example:
# AI_PROVIDER=ollama
# OLLAMA_BASE_URL=http://127.0.0.1:11434
# AI_DEFAULT_MODEL=llama3.1:8b
# OpenAI example:
# AI_PROVIDER=openai
# OPENAI_API_KEY=sk-your-api-key-here
# AI_DEFAULT_MODEL=gpt-4o-mini
```

### Ollama quick start

If you want local no-per-call-cost AI:

```bash
ollama serve
ollama pull llama3.1:8b
```

Recommended local env:

```bash
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
AI_DEFAULT_MODEL=llama3.1:8b
AI_MODEL_REWRITE=llama3.1:8b
AI_MODEL_SYNTHESIZE=llama3.1:8b
AI_MODEL_ENRICH=llama3.1:8b
VITE_AI_API_URL=http://localhost:8002
```

Then run:

```bash
npm run ai:api
npm run dev
```

Or use the Ollama-flavoured helper script:

```bash
npm run ai:api:ollama
```

The AI tab will show sidecar/provider health, fallback state, rewritten query,
synthesized answer, and evidence entries.

`npm run dev:all` now also starts or reuses a local Ollama instance through the
repo helper script, so local full-stack development can bring up API, frontend,
AI sidecar, Ollama, and Docker-backed services together.

---

## Database Setup

### Option 1: Using Docker (Recommended)

Start PostgreSQL using Docker Compose:

```bash
docker-compose up -d postgres
```

This will:
- Start PostgreSQL 16 in a container
- Expose port 5432
- Automatically run schema.sql on first startup
- Persist data in a Docker volume

Check if PostgreSQL is running:

```bash
docker-compose ps
```

### Option 2: Manual PostgreSQL Installation

If you have PostgreSQL installed locally:

1. Create a database:

```bash
createdb systemfehler
```

2. Create a user:

```bash
psql -d systemfehler -c "CREATE USER systemfehler WITH PASSWORD 'dev_password';"
psql -d systemfehler -c "GRANT ALL PRIVILEGES ON DATABASE systemfehler TO systemfehler;"
```

3. Run migrations:

```bash
psql $DATABASE_URL -f backend/database/schema.sql
```

Or use the npm script:

```bash
npm run db:migrate
```

### Verify Database Setup

Test the connection:

```bash
psql $DATABASE_URL -c "SELECT version();"
```

You should see PostgreSQL version information.

---

## Running Crawlers

### 1. Run the Arbeitsagentur Benefits Crawler

```bash
npm run crawl:benefits
```

Or using the Python CLI directly:

```bash
python crawlers/cli.py crawl benefits --source arbeitsagentur
```

This will:
- Fetch data from https://www.arbeitsagentur.de/arbeitslosengeld-2
- Extract benefit information
- Validate against JSON schemas
- Calculate quality scores (IQS and AIS)
- Save candidate entries to `data/benefits/candidates.json`
- Generate diffs and add to moderation queue

### 2. Validate Crawled Data

```bash
python crawlers/cli.py validate --domain benefits
```

This checks:
- JSON schema compliance
- Required fields present
- Data type correctness
- Recommended field completeness

### 3. Import Data to Database

```bash
npm run db:seed
```

Or:

```bash
python crawlers/cli.py import --domain benefits --to-db
```

This will:
- Replace existing PostgreSQL rows for all five domains from the current `data/*/entries.json` snapshots
- Preserve the canonical snapshot contract used by the frontend and API
- Allow single-domain imports through the Python CLI when needed

---

## Validation Pipeline (DATA-05)

Run full schema validation + lint checks over all domain entries:

```bash
# Local readable output (fails on schema/structural errors)
npm run validate

# Local readable output (always exits 0)
npm run validate:report

# CI-friendly JSON report + non-zero on validation errors
npm run validate:ci
```

Optional flags:

```bash
node scripts/validate_entries.js --domain=benefits --max-samples=10 --fail-on-errors=false
```

Checks included:
- Core + extension schema validation
- Unknown top-level field rejection
- Taxonomy ID validation (topics/tags/targetGroups)
- Lint warnings (missing recommended content/translations)

These validation commands do not import into PostgreSQL; they validate JSON snapshots only.
Use `npm run db:seed` to replace PostgreSQL data from the current snapshots, or the Python import command for one domain.

---

## Starting the API

Start the Express API server:

```bash
npm run api
```

The API will be available at: http://localhost:3001

### API Endpoints

- `GET /api/health` - Health check
- `GET /api/status` - System statistics
- `GET /api/data/entries` - Get entries with filtering
- `GET /api/data/entries/:id` - Get single entry
- `GET /api/data/moderation-queue` - Get moderation queue
- `GET /api/data/quality-report` - Get quality report

Test the API:

```bash
curl http://localhost:3001/api/health
```

---

## Starting the Frontend

### Development Mode

Start the Vite development server:

```bash
npm run dev
```

Or from the frontend directory:

```bash
cd frontend
npm run dev
```

The admin panel will be available at: http://localhost:5173

### Run API and Frontend Together

Use concurrently to run both servers:

```bash
npm run dev:all
```

This starts:
- API server on port 3001
- Frontend dev server on port 5173

---

## Cloudflare Worker API Deployment

### Worker Deployment (API)

1. Die API läuft als Cloudflare Worker unter https://systemfehler-api-worker.inequality.workers.dev
2. Die wrangler.worker.toml muss enthalten:
  - name = "systemfehler-api-worker"
  - main = "cloudflare-workers/index.js"
  - compatibility_date = "2026-03-08"
  - workers_dev = true
  - [[d1_databases]] mit korrektem database_id
3. Deploy mit:
  - `npx wrangler deploy --config wrangler.worker.toml`
4. Die Route /api/data/entries muss exakt so angesprochen werden (Query-Parameter erlaubt).
5. CORS-Header werden im Worker gesetzt (`Access-Control-Allow-Origin: *`).
6. Bei "Not found" oder CORS-Fehler:
  - Prüfe, ob die URL exakt /api/data/entries ist
  - Prüfe, ob der Worker-Code deployed ist
  - Prüfe, ob wrangler.worker.toml korrekt ist
  - Deploy-Befehl muss den richtigen Dateinamen nutzen

### Troubleshooting

### Database Connection Issues

**Error: "FATAL: password authentication failed"**

- Check your DATABASE_URL in `.env`
- Verify PostgreSQL is running: `docker-compose ps` or `pg_isready`
- Reset database password if needed

**Error: "database 'systemfehler' does not exist"**

- Create the database: `createdb systemfehler`
- Or restart Docker Compose: `docker-compose down && docker-compose up -d`

### Python Dependency Issues

**Error: "No module named 'bs4'"**

- Activate your virtual environment: `source venv/bin/activate`
- Install dependencies: `pip install -r crawlers/requirements.txt`

**Error: "command not found: python"**

- Use `python3` instead of `python`
- Or create an alias: `alias python=python3`

### Crawler Issues

**Error: "URL blocked by robots.txt"**

- This is expected behavior for some sites
- Check the target site's robots.txt file
- Adjust crawler settings or target URL

**Error: "Failed to fetch page"**

- Check your internet connection
- The target site may be down or blocking requests
- Try increasing the timeout in base_crawler.py

### Frontend Build Issues

**Error: "Cannot find module 'vite'"**

- Install frontend dependencies: `cd frontend && npm install`

**Error: "Port 5173 already in use"**

- Stop the other process using the port
- Or change the port in `frontend/vite.config.ts`

### API Issues

**Error: "Port 3001 already in use"**

- Stop the other process: `lsof -ti:3001 | xargs kill`
- Or change API_PORT in `.env`

**CORS Errors in Browser**

- Check that CORS is enabled in backend/server.js
- Verify the frontend is running on port 5173
- Update CORS_ORIGIN in `.env` if needed

### GitHub Pages Snapshot Mode

When running on GitHub Pages, the app reads same-origin snapshot JSON instead of `http://localhost:3001`:

- `/systemfehler/data/<domain>/entries.json`
- `/systemfehler/moderation/review_queue.json`

If the live site appears empty after a push, verify the latest `deploy-github-pages.yml` run succeeded and hard-refresh the page (`Ctrl+F5`).

---

## Next Steps

After successful setup:

1. **Explore the Admin Panel**: Open http://localhost:5173
   - View crawled data in Data Preview
   - Check quality metrics
   - Review moderation queue

2. **Add More Crawlers**: See `docs/crawling-guide.md`

3. **Customize Configuration**: Edit schemas in `data/_schemas/`

4. **Contribute**: See CONTRIBUTING.md (if available)

---

## Getting Help

- Check the main README.md for general information
- Review existing issues on GitHub
- See docs/architecture.md for system design
- Contact the maintainers for support
