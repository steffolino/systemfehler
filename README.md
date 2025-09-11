# systemfehler

**Digital tools for radical access: countering the failure of the welfare state with open-source solidarity.**

**systemfehler** (German for "system error") is an open-source infrastructure project exposing and replacing the failure of the German welfare state using solidarity-based, accessible, modular tech.

> **Das Recht auf Teilhabe ist nicht verhandelbar.**

---

## 🚀 Getting Started

For detailed architecture, workflow, and development setup, see **[WORKFLOW.md](./WORKFLOW.md)** - the canonical documentation for this project.

### Quick Start
```bash
# Clone and start with Docker
git clone https://github.com/steffolino/systemfehler.git
cd systemfehler
docker-compose up --build

# OR run frontend locally  
cd apps/fe && pnpm install && pnpm dev
```

---

## 📋 What This Project Does

- **Crawl** welfare and accessibility data from official sources
- **Structure** information into accessible, multilingual JSON
- **Serve** data through APIs and search interfaces  
- **Present** resources via an accessible web frontend

**Pipeline:** `crawl → parse → ingest → API → frontend`

---

## 🔒 License

[GNU AGPLv3](./LICENSE) – ensuring all contributions remain free and public.

---

**For complete documentation, architecture details, and development workflows, see [WORKFLOW.md](./WORKFLOW.md).**