# Systemfehler: End-to-End Data Flow

## 1. Crawl Domains via Scrapy
- **Entry Point:** `services/scrapy_crawler/run_all_spiders.py`
- **Spiders:** Each domain (benefits, aid, contacts, meta, tools) has its own spider (e.g. `benefits_spider.py`).
- **Seeds:** Reads sources from JSON config (e.g. `data/sources/benefits.json`).
- **Output:** Structured JSON to `data/{domain}/entries.json`.

## 2. Parse Content & Extract Topics
- **Where:** Inside each spider's `parse` method (e.g. `services/scrapy_crawler/benefits_spider.py`)
- **What:** Extracts: title, summary, topics, emails, phones, addresses, social media, tags, etc.
- **How:** Regex + frequency analysis for keywords; attaches domain/topic metadata.

## 3. Ingest into Database
- **Entry Point:** `services/ingest/ingest.ts` (Postgres) OR scripts in `services/api/scripts/` (SQLite)
- **How:** Run with:
  ```sh
  node services/ingest/ingest.ts --dir data/benefits
  ```
- **Logic:** Validates JSON, deduplicates, calls upsert for each kind (`Benefit`, `Tool`, `AidOffer`).
- **Schema:** Tables per entity; topics are arrays and linked in junction tables.
- **Materialized View:** Calls `refreshMV()` to update search views.

## 4. Update API
- **Express API:** `services/api/index.js` (local) OR `api/worker.js` (Cloudflare Worker)
- **Routes:** `/api/benefits`, `/api/search`, `/api/search/topics`, etc.
- **Topics Endpoint:** Aggregates topics and counts from all entities.
- **Data Served:** Entries with topics, summaries, metadata.

## 5. Update Frontend
- **Nuxt 3 App:** `apps/fe/`
- **Topic Search:** `apps/fe/app/composables/useSearch.ts` & `useTopics.ts`
- **Pages:** 
  - `/topic/[topic].vue` – lists entries for a topic.
  - `/benefits/index.vue` & `/benefits/[id].vue` – lists/reads entries.
- **API Consumption:** Fetches from `/api/search`, `/api/benefits`, `/api/search/topics`.

---

## Example Data & Dev Commands:

### Crawler
```sh
python services/scrapy_crawler/run_all_spiders.py
```

### Ingest (Postgres)
```sh
node services/ingest/ingest.ts --dir data/benefits
```

### API (Express)
```sh
cd services/api
npm install
node index.js
```

### Frontend
```sh
cd apps/fe
yarn install
yarn dev
```

---

## References
- Data: `data/{domain}/entries.json`
- Crawler logic: `services/scrapy_crawler/`
- Ingest scripts: `services/ingest/ingest.ts`, `services/api/scripts/`
- API: `services/api/index.js`, `api/worker.js`
- Frontend: `apps/fe/app/pages/`, `apps/fe/app/composables/`

---

## See Also
- [README_NEU.md](./README_NEU.md)
- [docs/structure.md](./docs/structure.md)
- [CONTRIBUTING.md](./CONTRIBUTING.md)