Developer Setup – Quickstart
1. Prerequisites
Node.js 20 LTS

npm ≥ 9

(Optional) Docker & Docker Compose

Cloudflare account (for deployment)

2. Install dependencies
bash
Copy
Edit
# At repo root
npm i -D concurrently

# API
cd services/api
npm install

# Crawler
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
NUXT_PUBLIC_API_BASE=https://<your-cloudflare-subdomain>.pages.dev
nuxt.config.ts:

ts
Copy
Edit
export default defineNuxtConfig({
  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'https://<your-cloudflare-subdomain>.pages.dev'
    }
  }
})
API
Optional services/api/.env:

ini
Copy
Edit
PORT=3001

4. Run the crawler (local development)
Example for benefits:

bash
Copy
Edit
cd services/crawler-benefits
npm run start
Writes benefits.json into services/api/data/.

5. Start API + frontend (local development)
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

6. Verify (local)
API:
curl http://localhost:3001/api/benefits → JSON

Frontend:
Open http://localhost:3000 → list of benefits

7. Cloudflare Deployment

a. Install wrangler globally if not present:
bash
Copy
npm install -g wrangler

b. At repo root, create wrangler.toml:
toml
Copy
name = "systemfehler"
main = "services/api/index.js"
compatibility_date = "2024-06-01"
account_id = "<your-cloudflare-account-id>"
workers_dev = true

[site]
bucket = "./apps/fe/.output/public"
entry-point = "."

c. Build frontend for static hosting:
bash
Copy
cd apps/fe
npm run build

d. Deploy to Cloudflare Pages:
bash
Copy
cd ../..
wrangler pages publish apps/fe/.output/public --project-name=systemfehler

e. (Optional) Deploy API as a Cloudflare Worker:
bash
Copy
cd services/api
wrangler deploy

8. Notes
- Use a managed cloud database (e.g., Cloudflare D1, Supabase, etc.) for production. Do not store .db files in the repo.
- Store secrets and DB connection strings in Cloudflare environment variables.
- Update docs if you change ports, paths, or crawler output.

## Quick Cloudflare Deployment Steps

1. **Build the frontend for static hosting:**
   ```bash
   npm run build:frontend
   ```

2. **Publish the frontend to Cloudflare Pages:**
   ```bash
   npm run deploy:frontend
   ```

3. **(Optional) Deploy the API as a Cloudflare Worker:**
   ```bash
   npm run deploy:api
   ```

4. **Set up environment variables and secrets in the Cloudflare dashboard as needed (e.g., database connection strings).**

5. **Your site will be live at:**  
   `https://<your-cloudflare-subdomain>.pages.dev`

## Step-by-step Cloudflare Deployment Guide

1. **Install dependencies (if not done yet):**
   ```bash
   npm run install:all
   ```

2. **Build the frontend for static hosting:**
   ```bash
   npm run build:frontend
   ```

3. **Publish the frontend to Cloudflare Pages:**
   ```bash
   npm run deploy:frontend
   ```

4. **(Optional) Deploy the API as a Cloudflare Worker:**
   ```bash
   npm run deploy:api
   ```

5. **Set up environment variables and secrets:**
   - Go to your Cloudflare dashboard.
   - Open your Pages/Worker project settings.
   - Add any required environment variables (e.g., database connection strings).

6. **Verify your deployment:**
   - Visit `https://<your-cloudflare-subdomain>.pages.dev` to check the frontend.
   - Test API endpoints if you deployed the API as a Worker.

7. **(Optional) Troubleshooting:**
   - Check Cloudflare dashboard logs for errors.
   - Ensure all environment variables are set correctly.
   - Rebuild and redeploy if you make changes.

9. Configure your D1 database for local development

If you see the error:

```
You must use a real database in the database_id configuration. You can find your databases using 'wrangler d1 list', or read how to develop locally with D1 here: https://developers.cloudflare.com/d1/configuration/local-development
```

**Solution:**

- Run the following to list your D1 databases:
  ```bash
  npx wrangler d1 list
  ```
- Copy the `id` of your database (e.g. `abcd1234-xxxx-xxxx-xxxx-xxxxxxxxxxxx`).
- In your `wrangler.toml`, set the binding to your real database:
  ```toml
  [[d1_databases]]
  binding = "DB"
  database_id = "<your-database-id>"
  ```
- For local development, you can also use a local D1 database. See:
  https://developers.cloudflare.com/d1/configuration/local-development

- After updating, re-run your deploy or dev command.

## Troubleshooting Common Issues

- **Build or deployment failures:** Check the Cloudflare dashboard for error messages. Ensure all environment variables are set and that the build command completes successfully.

- **API not responding or 404 errors:** Ensure the API is deployed and the correct route is being accessed. Check Cloudflare Worker settings and logs.

- **Frontend not displaying data:** Verify the API endpoint is correct and accessible. Check browser console for errors.

- **CORS issues:** Ensure your Cloudflare Worker is configured to allow requests from your frontend's origin.

- **Environment variable issues:** Double-check that all required environment variables are set in the Cloudflare dashboard and are correctly referenced in your code.

# Deployment

## Frontend (Cloudflare Pages)
Build and deploy the frontend using the Pages config:
```bash
wrangler --config wrangler.pages.toml pages deploy ./apps/fe/.output/public --project-name=systemfehler
```

## API (Cloudflare Worker)
Deploy the API using the Worker config:
```bash
wrangler --config wrangler.worker.toml deploy
```

## Notes
- Use `wrangler.pages.toml` for frontend-only deployments.
- Use `wrangler.worker.toml` for API/Worker deployments.
- Switch configs as needed for each deployment type.