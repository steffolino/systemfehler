# 🚀 systemfehler MVP Plan – Public Roadmap

**systemfehler** is a digital infrastructure project for radical access and solidarity tech.  
This is our public-facing plan for the first MVP release.

---

## 🧭 Goal of the MVP

Build a **minimum viable system** to:
- Collect & structure useful tools and help offers
- Display them accessibly in the UI
- Allow community translation and verification
- Be extendable, inspectable, and trustworthy

---

## 📦 What will the MVP include?

| Module | Feature | Status |
|--------|---------|--------|
| 🧱 Architecture | Modular, per-domain structure | ✅ done |
| 🧭 Crawler | Working example for `tools` or `benefits` | 🚧 in progress |
| 🧾 JSON Data | Valid entries with tags, lang, links | ✅ partially |
| 🌍 Frontend | UI with search, language toggle, detail view | 🚧 in progress |
| 🧑‍💻 Editorial UI | Ability to flag or correct content | ⏳ planned |
| 🤝 Plain Language | Extra field for human translation | ⏳ planned |
| 🧠 AI Enrichment | Optional LLM tags/summary generation | 🔜 optional |

---

## 🧩 Epic Breakdown + Subtasks

### 1. Modular Crawler per Domain

- [ ] Scaffold base crawler framework
- [ ] Add working crawler for one domain (e.g. CCC tools)
- [ ] Output must match `entries.json` schema
- [ ] Handle `lang`, `tags`, `related_links`
- [ ] Log broken/flagged entries
- [ ] Track crawler source URLs in `urls.json`

---

### 2. Unified JSON Schema + Validation

- [ ] Define JSON schema for entries
- [ ] Create schema validator (Python CLI)
- [ ] Check all current data for compliance
- [ ] Add check to CI (optional)

---

### 3. Editorial Dashboard / Moderation

- [ ] Add `status` field: `draft`, `approved`, `flagged`
- [ ] Add list filters to frontend UI
- [ ] Build mod view (approve/delete/edit entries)
- [ ] Track editor actions (optional)

---

### 4. Plain Language Translation

- [ ] Add `plain_description` to each entry
- [ ] Show difference between original and simplified
- [ ] Allow contributions from translators
- [ ] Flag missing simplified text

---

### 5. Enrichment + LLM Integration

- [ ] Add optional `ai_summary`, `ai_tags`, or `embedding`
- [ ] Generate LLM-based tag suggestions (offline or GPT API)
- [ ] Display enriched data visually
- [ ] Keep AI output separate from human input

---

## 🗓️ Priority for MVP Release

1. ✅ Finalize data structure + example entries  
2. ✅ Get one crawler working  
3. ✅ Display entries in frontend  
4. ✅ Add search & language toggle  
5. ✅ Translate some content manually  
6. 🛠 Optionally: enrichment, mod tools, sync

---

## 🖼️ Want to Help?

- Create entries in your language
- Help us define what counts as a “tool” or “aid”
- Join our editorial/tester group
- Build crawlers for your region
