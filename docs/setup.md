# Systemfehler Setup Guide

This guide provides detailed instructions for setting up the Systemfehler data platform for local development.

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
```

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
- Read entries from `data/benefits/entries.json`
- Validate each entry
- Insert into PostgreSQL (upsert on ID)
- Insert domain-specific data into benefits table
- Generate import summary

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

## Troubleshooting

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
