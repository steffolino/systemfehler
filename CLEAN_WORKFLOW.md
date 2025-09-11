# Clean Workflow: systemfehler

This document outlines the clean, unified workflow for the systemfehler project as requested.

## Overview

The systemfehler project implements a complete pipeline for crawling, processing, and serving social welfare data. The workflow consists of 5 main steps:

1. **Crawl domains via scrapy** → JSON files
2. **Parse content to extract topics and searchable data** → Structured data  
3. **Ingest into database** → SQLite/PostgreSQL
4. **Update API** → REST endpoints
5. **Update frontend** → User interface

## 🚀 Quick Start

```bash
# Complete pipeline
python workflow.py --step all

# Individual steps  
python workflow.py --step crawl         # Crawling only
python workflow.py --step ingest        # Database ingestion
python workflow.py --step api           # Start API server
python workflow.py --step frontend      # Start frontend

# Test mode (no actual changes)
python workflow.py --step all --dry-run
```

## 📁 Project Structure

```
systemfehler/
├── workflow.py                    # 🎯 Main unified workflow script
├── services/
│   ├── scrapy_crawler/           # 🕷️  Web crawling (Scrapy)
│   │   ├── scrapy.cfg
│   │   ├── crawler/
│   │   │   ├── settings.py
│   │   │   └── spiders/          # Individual spiders
│   │   │       ├── benefits_spider.py
│   │   │       ├── aid_spider.py
│   │   │       ├── tools_spider.py
│   │   │       ├── contacts_spider.py
│   │   │       └── meta_spider.py
│   ├── ingest/                   # 📥 Database ingestion (Node.js)
│   │   ├── ingest.ts
│   │   └── package.json
│   └── api/                      # 🌐 REST API (Express + SQLite)  
│       ├── index.js
│       ├── db/schema.sql
│       └── routes/
├── apps/
│   └── fe/                       # 🎨 Frontend (Nuxt.js)
│       ├── nuxt.config.ts
│       └── app/
├── data/                         # 💾 Crawled data storage
│   ├── benefits/entries.json
│   ├── aid/entries.json  
│   ├── tools/entries.json
│   └── contacts/entries.json
└── master_domains.json           # 🎯 Domain configuration
```

## 🔄 Workflow Steps

### Step 1: Crawling Domains via Scrapy

**Location**: `services/scrapy_crawler/`

**What it does**:
- Runs multiple specialized spiders (benefits, aid, tools, contacts, meta)  
- Generates mock data for testing in sandboxed environments
- Extracts structured information: titles, content, emails, phones, addresses
- Outputs JSON files with consistent schema

**Configuration**: 
- Proper Scrapy project structure with `scrapy.cfg` and `settings.py`
- Modern FEEDS configuration (replaces deprecated FEED_URI)
- Rate limiting and politeness settings

**Data Format**:
```json
{
  "kind": "benefit",
  "id": "benefit_tafel.de", 
  "title_de": "Tafel Deutschland - Food Aid",
  "summary_de": "food aid, tafel, charity, volunteer",
  "url": "https://tafel.de",
  "category": "welfare",
  "language": ["de"],
  "topic": ["food aid", "tafel", "charity", "volunteer"],
  "content": "Die Tafeln retten Lebensmittel...",
  "emails": ["info@tafel.de"],
  "phones": ["030-12345678"],
  "addresses": ["Tafel Deutschland e.V., Berlin"],
  "social_media": ["https://facebook.com/tafel.de"],
  "tags": ["food aid", "tafel", "charity", "volunteer"]
}
```

### Step 2: Parse Content & Extract Topics  

**Integrated into crawling step**

**What it does**:
- Keyword extraction from page content
- Topic classification based on content analysis  
- Contact information extraction (emails, phones, addresses)
- Social media profile detection
- Structured data normalization

### Step 3: Ingest into Database

**Location**: `services/ingest/`

**What it does**:
- Converts JSON arrays to NDJSON (newline-delimited JSON)
- Validates required fields (`kind`, `id`, `title_de`)
- Handles deduplication
- Supports PostgreSQL and SQLite backends
- Updates materialized views for performance

**Usage**:
```bash
# Ingest specific file
node ingest.js --file data/benefits/entries.ndjson

# Ingest entire directory  
node ingest.js --dir data/benefits/

# Dry run validation
node ingest.js --file data.ndjson --dry-run
```

### Step 4: API Server

**Location**: `services/api/`

**What it does**:
- Serves REST endpoints for all entity types
- SQLite database with full-text search
- CORS enabled for frontend access
- Structured entity routing system

**Endpoints**:
- `GET /api/benefits` - List benefits
- `GET /api/aid` - List aid offers  
- `GET /api/tools` - List tools
- `GET /api/contacts` - List contacts
- `GET /api/search` - Search across entities

**Usage**:
```bash
cd services/api
npm run dev  # Starts on http://localhost:3001
```

### Step 5: Frontend Interface

**Location**: `apps/fe/`

**What it does**:
- Nuxt.js 4 with TypeScript
- Responsive design with TailwindCSS + DaisyUI
- Internationalization support (i18n)
- Connects to API for data display

**Usage**:
```bash
cd apps/fe  
pnpm run dev  # Starts on http://localhost:3000
```

## 🛠️ Technical Implementation

### Dependencies

**System Requirements**:
- Node.js 18+ with pnpm
- Python 3.8+ with pip
- SQLite3

**Python Packages**:
```bash
pip install scrapy requests beautifulsoup4
```

**Node.js Packages**: Managed via workspaces in `package.json`

### Database Schema

The system uses SQLite with the following core tables:
- `benefit` - Benefits information
- `aid` - Aid offers  
- `tool` - Available tools
- `contact` - Contact information
- `topic` - Topic taxonomy
- Entity relationships and junction tables

### Error Handling

- Graceful DNS failure handling in crawlers
- Input validation in ingest pipeline  
- Fallback to mock data in restricted environments
- Comprehensive logging throughout

## 🧪 Testing

The workflow includes comprehensive testing capabilities:

```bash
# Test individual components
python workflow.py --step crawl --dry-run
python workflow.py --step ingest --dry-run

# Validate data format
python -c "
import json
with open('data/benefits/entries.ndjson') as f:
    for line in f:
        record = json.loads(line)
        print(f'✓ {record[\"kind\"]} - {record[\"id\"]}')
"

# Test API endpoints  
curl http://localhost:3001/api/benefits
```

## 🔧 Configuration

### Environment Variables

Create `.env` files as needed:

**API** (`services/api/.env`):
```bash
DATABASE_URL=sqlite://../../.generated/local.sqlite
PORT=3001
```

**Frontend** (`apps/fe/.env`):
```bash  
NUXT_PUBLIC_API_BASE=http://localhost:3001
```

### Domain Configuration

Edit `master_domains.json` to configure crawling targets:

```json
[
  {
    "domain": "example.org",
    "name": "Example Organization", 
    "category": "welfare",
    "tags": ["benefits", "social", "support"],
    "active": true
  }
]
```

## 📋 Checklist for Production

- [ ] Configure real domain list in `master_domains.json`
- [ ] Set up PostgreSQL database for production
- [ ] Configure environment variables
- [ ] Set up scheduled crawling (cron jobs)
- [ ] Configure reverse proxy (nginx)
- [ ] Set up SSL certificates
- [ ] Configure monitoring and logging
- [ ] Set up backup strategies

## 🚨 Troubleshooting

**Common Issues**:

1. **Scrapy spiders not found**: Ensure proper project structure with `scrapy.cfg`
2. **Database connection errors**: Check DATABASE_URL and database permissions  
3. **CORS errors**: Verify API CORS configuration
4. **Frontend build fails**: Check Node.js version and dependencies
5. **DNS lookup failures**: Expected in sandboxed environments, spiders fall back to mock data

**Debug Commands**:
```bash
# Check scrapy configuration
cd services/scrapy_crawler && scrapy list

# Test database connection  
sqlite3 .generated/local.sqlite ".tables"

# Check API health
curl -f http://localhost:3001/api/benefits || echo "API not responding"
```

## 📈 Performance Considerations

- Scrapy auto-throttling prevents overwhelming target sites
- SQLite with materialized views for fast queries
- NDJSON streaming for large datasets  
- Incremental updates supported
- Caching strategies in frontend

## 🤝 Contributing

This clean workflow provides a solid foundation for:
- Adding new spiders for additional domains
- Extending the data schema
- Adding new API endpoints  
- Improving frontend features
- Scaling to larger datasets

The modular architecture ensures each component can be developed and tested independently while maintaining a cohesive end-to-end pipeline.