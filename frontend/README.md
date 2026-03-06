# Systemfehler Frontend

React + TypeScript + Vite admin interface for viewing and validating Systemfehler data snapshots.

## Development

From repository root:

```bash
npm run dev
```

Or from `frontend/`:

```bash
npm install
npm run dev
```

Dev server default: `http://localhost:5173`.

## Build

```bash
npm run build
```

For GitHub Pages, the workflow builds with:

```bash
PUBLIC_PATH=/systemfehler/
```

## Data Access Model

The frontend supports two modes:

1. **Local API mode** (development)
   - Uses backend API (default `http://localhost:3001`) via `frontend/src/lib/api.ts`.

2. **Static snapshot mode** (GitHub Pages)
   - Uses same-origin JSON snapshots bundled into the Pages artifact:
     - `/systemfehler/data/<domain>/entries.json`
     - `/systemfehler/moderation/review_queue.json`

This avoids cross-origin requests to raw GitHub URLs and prevents CORS failures in production.

## Environment Variables

- `VITE_API_URL`: Override backend API base URL.
- `VITE_SNAPSHOT_BASE_URL`: Optional override for snapshot JSON base URL.
- `PUBLIC_PATH`: Build-time Vite base path (set by deployment workflow).

## Deployment

- Primary deployment (frontend + API): `.github/workflows/deploy-pages.yml`
- Primary public URL: `https://systemfehler.pages.dev/`
- Static fallback deployment: `.github/workflows/deploy-github-pages.yml`
- Fallback URL: `https://steffolino.github.io/systemfehler/`
