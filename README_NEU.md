# systemfehler

**Digital tools for radical access: countering the failure of the welfare state with open-source solidarity.**

**systemfehler** (German for “system error”) is an open-source infrastructure project exposing and replacing the failure of the German welfare state using solidarity-based, accessible, modular tech.

> **Das Recht auf Teilhabe ist nicht verhandelbar.**

---

## Aktueller Stand & Architektur (2025)

**Frontend:**
- Nuxt 3, TailwindCSS, DaisyUI, Vue I18n
- Theme-Konfiguration: siehe `apps/fe/assets/css/main.css`
- Zwei Themes: `systemfehler_light` (lofi) und `systemfehler_dark` (abyss)

**API:**
- Lokal: Express-App (`services/api/index.js`) mit SQLite (`services/api/db/database.sqlite`)
- Remote: Cloudflare Worker (Deploy via `wrangler.toml`), Datenbank: Cloudflare D1

**Crawler:**
- Python (`services/crawler.py`), modular pro Domain
- TypeScript-Crawler (`crawler.ts`) ist veraltet und kann entfernt werden

**Daten:**
- Strukturierte JSON-Daten pro Domain (`data/benefits/entries.json`, ...)

**Dokumentation:**
- Siehe `docs/` für Architektur, DDD, Style Guide, Konventionen

---

## Theme-Konfiguration (Tailwind/DaisyUI)

```css
@import "tailwindcss";
@plugin "daisyui" { themes: lofi, abyss; logs: false; }

@plugin "daisyui/theme" {
  name: systemfehler_light;
  base: lofi;
  default: true;
  color-scheme: light;
  /* ...siehe main.css für alle Tokens... */
}

@plugin "daisyui/theme" {
  name: systemfehler_dark;
  base: abyss;
  prefersdark: true;
  color-scheme: dark;
  /* ...siehe main.css für alle Tokens... */
}

@plugin "daisyui" {
  themes: systemfehler_light --default, systemfehler_dark --prefersdark;
}
```

---

## Quickstart

```bash
# Klonen
git clone https://github.com/steffolino/systemfehler.git
cd systemfehler

# Frontend + API via Docker starten
docker-compose -f docker-compose.dev.yml up --build

# Oder lokal:
cd apps/fe
pnpm install
pnpm dev
```

---

## Domain-Driven Design (DDD)

Jede Domain (`benefits`, `tools`, `news`, `guides`, ...) hat:
- Eigene Crawler-Pipeline
- Eigene Daten (`data/{domain}/entries.json`)
- Gemeinsame Schema- und Metadaten-Konventionen

Siehe `docs/domains.md` und `docs/conventions.md`

---

## Projektpflege

- Veraltete Dateien werden regelmäßig entfernt (siehe `UNUSED_REPORT.md`)
- Lockfiles und Build-Ordner konsolidieren
- Beispiel-/Testdaten und nicht genutzte Medien regelmäßig prüfen

---

## Lizenz
AGPLv3
