Developer Setup – Quickstart
1. Prerequisites
Node.js 20 LTS

npm ≥ 9

(Optional) Docker & Docker Compose

2. Install dependencies
bash
Copy
Edit
# At repo root
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
3. Configure environment
Frontend (Nuxt)
Create apps/fe/.env:

ini
Copy
Edit
NUXT_PUBLIC_API_BASE=http://localhost:3001
nuxt.config.ts:

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
API
Optional services/api/.env:

ini
Copy
Edit
PORT=3001
4. Run the crawler
Example for benefits:

bash
Copy
Edit
cd services/crawler-benefits
npm run start
Writes benefits.json into services/api/data/.

5. Start API + frontend
At repo root, in package.json:

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
Ensure services/api/package.json has:

json
Copy
Edit
{
  "scripts": {
    "dev": "node index.js"
  }
}
Run:

bash
Copy
Edit
npm run dev
6. Verify
API:
curl http://localhost:3001/api/benefits → JSON

Frontend:
Open http://localhost:3000 → list of benefits

7. Notes
For SSR fetch, ensure API is reachable from server process.
In Docker: NUXT_PUBLIC_API_BASE=http://api:3001

If using browser-only fetch, enable CORS in API.

Update docs if you change ports, paths, or crawler output.