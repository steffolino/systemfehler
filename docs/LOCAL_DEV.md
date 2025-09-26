# Lokale Entwicklung: Quick-Start

## 1) DB Schema anlegen

```sh
sqlite3 data/systemfehler.db < scripts/schema.sql
```

## 2) Crawlen (Beispiel)

```sh
cd services/scrapy_crawler
scrapy crawl generic_site -a source=benefits.json
```

## 3) ETL

```sh
python scripts/etl.py data/systemfehler.db
```

## 4) API starten

```sh
cd ../api
npm run dev  # http://127.0.0.1:8787
```

## 5) Frontend starten

```sh
cd ../../apps/fe
pnpm dev     # http://localhost:3000
```

---

Alle ENV-Variablen siehe /config/.env.example.

Weitere Details siehe README.md und CLEAN_WORKFLOW.md.
