# Cloudflare Worker API

## Commands

```sh
npm run d1:apply           # apply schema to D1
npm run dev:api:worker     # run Worker locally (from repo root)
npm --workspace services/api run dev:worker  # alternative
npm run deploy:api         # deploy Worker
```

## Test

```sh
curl http://127.0.0.1:8787/api/health
curl "http://127.0.0.1:8787/api/search/topics?limit=5"
```
