# D1 Setup for systemfehler Cloudflare Pages

## 1. Create the D1 database

```bash
npx wrangler d1 create systemfehler-db
```

Note the `database_id` from the output.

## 2. Apply the schema

```bash
npx wrangler d1 execute systemfehler-db --file=cloudflare-pages/d1/schema.sql
```

This creates both `entries` and `moderation_queue` tables required by the
Cloudflare Pages API endpoints.

## 3. Bind the database to the Pages project

In the Cloudflare dashboard:

1. Go to **Workers & Pages** → **systemfehler** → **Settings** → **Functions**.
2. Under **D1 database bindings**, add a binding:
   - **Variable name**: `DB`
   - **D1 database**: select `systemfehler-db`
3. Save and redeploy.

Alternatively, add the binding via a `wrangler.toml` at the repo root or in
`cloudflare-pages/` (not required for Pages deployments but useful for local
development with `wrangler pages dev`):

```toml
[[d1_databases]]
binding = "DB"
database_name = "systemfehler-db"
database_id   = "<your-database-id>"
```

## 4. Set the INGEST_TOKEN secret

In the Cloudflare dashboard:

1. Go to **Workers & Pages** → **systemfehler** → **Settings** → **Environment variables**.
2. Add a secret (encrypted):
   - **Variable name**: `INGEST_TOKEN`
   - **Value**: a long random string (e.g. `openssl rand -hex 32`)
3. Save.

Store the same value as a **repository secret** in GitHub (Settings → Secrets and
variables → Actions → New repository secret):
- **Name**: `INGEST_TOKEN`
- **Value**: the same token as above

Also add the Pages base URL as a repository secret:
- **Name**: `PAGES_INGEST_URL`
- **Value**: e.g. `https://systemfehler.pages.dev`

## 4b. Add Turnstile and frontend build variables

For bot protection and Auth0-enabled frontend builds, configure:

### Cloudflare Pages secrets

- `TURNSTILE_SECRET_KEY`

### GitHub Actions variables

- `VITE_TURNSTILE_SITE_KEY`
- `VITE_AUTH0_DOMAIN`
- `VITE_AUTH0_CLIENT_ID`

These public frontend values are injected during the Pages build by
`.github/workflows/deploy-pages.yml`.

## 5. Verify

After deployment, check the health endpoint:

```bash
curl https://systemfehler.pages.dev/api/health
```

And test an ingest (replace `<token>` and `<url>`):

```bash
curl -X POST https://systemfehler.pages.dev/api/admin/ingest \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"domain":"benefits","entries":[]}'
```
