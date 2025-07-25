# systemfehler

**Digital tools for radical access: countering the failure of the welfare state with open-source solidarity.**

**systemfehler** (German for “system error”) is an open-source infrastructure project exposing and replacing the failure of the German welfare state using solidarity-based, accessible, modular tech.

> **Das Recht auf Teilhabe ist nicht verhandelbar.**

---

## 🚀 Elevator Pitch

**EN:**  
*systemfehler* is a digital infrastructure project countering the collapse of the German welfare system with modular, accessible, and open-source solidarity tools. It supports those left behind by bureaucracy, stigma, and digital exclusion.

**DE:**  
*systemfehler* ist ein digitales Infrastrukturprojekt, das den Zusammenbruch des Sozialstaats mit zugänglichen, modularen und quelloffenen Solidaritäts-Werkzeugen beantwortet. Es richtet sich an Menschen, die von Bürokratie, Stigmatisierung und digitaler Ausgrenzung betroffen sind.

---

## ❌ Problem Statement

**EN:**  
The German welfare state is fragmented, hostile, and often inaccessible. Information is hidden behind bureaucratic walls, support is inconsistently delivered, and digital tools rarely consider real-life vulnerability. *systemfehler* addresses this by replacing institutional opacity with radical transparency and mutual aid.

**DE:**  
Der deutsche Sozialstaat ist fragmentiert, feindlich und oft unzugänglich. Informationen sind versteckt, Leistungen schwer auffindbar und digitale Angebote berücksichtigen selten reale Lebenslagen. *systemfehler* setzt hier an – mit radikaler Transparenz, Teilhabe und digitaler Selbstermächtigung.

---

## 🧱 Architecture Overview

This monorepo includes all core modules:

- `apps/frontend/` – accessible user interface (Nuxt 3, i18n, TailwindCSS, SQLite)
- `services/crawler/` – Python-based modular crawler framework per domain (e.g. benefits, tools)
- `services/api-tools/` – JSON API providing structured access to enriched data
- `data/` – machine-readable, LLM-friendly content in JSON (e.g. tools, benefits, slogans)
- `docs/` – project documentation (structure, DDD, editorial flows)

See also: [`docs/structure.md`](./docs/structure.md), [`docs/domains.md`](./docs/domains.md), [`docs/conventions.md`](./docs/conventions.md)

---

## 🧪 Quickstart (Dev Environment)

```bash
# Clone the repo
git clone https://github.com/steffolino/systemfehler.git
cd systemfehler

# Start frontend + services using Docker
docker-compose -f docker-compose.dev.yml up --build

# OR run frontend locally
cd apps/frontend
pnpm install
pnpm dev
```

For full setup details, see [`docs/dev.md`](./docs/dev.md)

---

## 🧭 Domain-Driven Design (DDD)

Each domain (benefits, tools, news, guides, etc.) is independently structured:
- Own crawler pipeline
- Own `data/{domain}/entries.json`
- Same shared schema and metadata conventions

All entries are:
- Tagged (topic, audience, trigger)
- Multilingual (`lang`, `title`, `description`, `source`)
- Extendable (e.g. `related_links`, plain-language, GND links)

See [`docs/domains.md`](./docs/domains.md) and [`docs/conventions.md`](./docs/conventions.md)

---

## 🔒 License

[GNU AGPLv3](./LICENSE) – to keep all contributions free and public.

---

## 🤝 Contributing

Pull requests welcome. See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for how to join the revolution.

We value contributions that:
- Improve accessibility
- Expand data coverage
- Translate or simplify content
- Improve resilience against bureaucratic or political friction

---

**Keywords**: solidarity, digital inclusion, welfare, accessibility, anticapitalism, open knowledge, civic tech
