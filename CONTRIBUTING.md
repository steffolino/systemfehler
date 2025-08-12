# Contributing to systemfehler

Thanks for your interest in building digital resistance tools.

## How to contribute

- Pick an [issue](../../issues) labeled `good first issue` or `help wanted`
- Fork this repo
- Create a new branch
- Commit with clear commit messages 😉
- Open a pull request – we'll review it together

## Code style

- Write clean, readable code
- Use comments generously if logic is complex
- Follow the structure in `/apps`, `/services`, and `/data`

## Who can contribute?

Everyone – especially those excluded by the very system this project critiques. Designers, translators, writers, social workers, coders, data nerds, researchers: welcome.

Contributing Guide
1. Overview
This project consists of three main parts:

graphql
Copy
Edit
services/
  api/                  # Express API serving JSON from crawlers
  crawler-benefits/     # Example crawler for benefits data (others possible)
apps/
  fe/                   # Nuxt 3 frontend consuming the API
The workflow is:

Crawler fetches raw data from target sources and saves it into JSON files under services/api/data/.

API serves these JSON files over HTTP endpoints.

Frontend fetches from the API and renders the data in the UI.

2. Prerequisites
Node.js 20 LTS (recommended)

npm ≥ 9

(Optional) Docker & Docker Compose for containerized dev

3. First-time setup
Install dependencies for each part:

bash
Copy
Edit
# At repo root:
npm i -D concurrently

# API
cd services/api
npm install

# Crawler(s)
cd ../crawler-benefits
npm install

# Frontend
cd ../../apps/fe
npm install
4. Environment configuration
Frontend (Nuxt)
Use Nuxt runtime config to avoid hard-coded URLs.
Create apps/fe/.env:

ini
Copy
Edit
NUXT_PUBLIC_API_BASE=http://localhost:3001
In apps/fe/nuxt.config.ts ensure:

ts
Copy
Edit
export default defineNuxtConfig({
  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:3001'
    }
  }
})
API (Express)
If you need a different port, create services/api/.env:

ini
Copy
Edit
PORT=3001
5. Running the crawler
Crawlers are independent Node.js scripts that fetch and normalize data.

Example for benefits crawler:

bash
Copy
Edit
cd services/crawler-benefits
npm run start
This will:

Crawl configured sources (e.g., Bundesagentur für Arbeit)

Save structured JSON into services/api/data/ (e.g., benefits.json)

Overwrite existing files if updated

You can run crawlers on demand, or set them up as a scheduled task.

6. Starting API and frontend
One-command dev (preferred)
At repo root, add these scripts to package.json:

json
Copy
Edit
{
  "scripts": {
    "dev:api": "cd services/api && npm run dev",
    "dev:frontend": "cd apps/fe && npm run dev",
    "dev": "concurrently -n API,WEB -c green,cyan \"npm:dev:api\" \"npm:dev:frontend\""
  }
}
Ensure API has a dev script in services/api/package.json:

json
Copy
Edit
{
  "scripts": {
    "dev": "node index.js"
  }
}
(or "nodemon index.js" if using nodemon)

Run both at once:

bash
Copy
Edit
npm run dev
Running separately
bash
Copy
Edit
# Terminal 1
cd services/api && npm run dev

# Terminal 2
cd apps/fe && npm run dev
7. Sanity checks
API:

bash
Copy
Edit
curl http://localhost:3001/api/benefits
Should return JSON from the crawler output.

Frontend:
Open http://localhost:3000 and check that "Benefits" are listed.

If SSR fetch fails in frontend, try:

ts
Copy
Edit
useFetch('/api/benefits', { baseURL, server: false })
but fix SSR reachability for production.

8. Troubleshooting
SSR cannot reach API
Use an address reachable from the server process. In Docker:

ini
Copy
Edit
NUXT_PUBLIC_API_BASE=http://api:3001
CORS errors in browser
If fetching client-side, enable CORS in API:

js
Copy
Edit
const cors = require('cors')
app.use(cors({ origin: true, credentials: true }))
SSR fetch does not need CORS.

Windows path issues
Use cd … && npm run dev in scripts to avoid --prefix quirks.

Data shape changes
If API returns { items: [...] } instead of [...], update frontend loops.

9. Git workflow
main = stable

Feature branches: feat/<short-name>

Bugfix branches: fix/<short-name>

Commit style: Conventional Commits (e.g., feat:, fix:, chore:)
Pull requests: small, with clear "What / Why / How to test".

10. Updating documentation
If you change scripts, ports, paths, or crawler output format, update:

CONTRIBUTING.md

Any README.md in services/ or apps/

Any developer setup guides in docs/