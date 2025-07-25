# 📌 systemfehler MVP Roadmap

This issue serves as a high-level overview of our MVP development milestones.  
It is pinned for transparency and contributor orientation.

---

## 🎯 Goal

To release a working public prototype of `systemfehler` that allows:
- Structured, multilingual, accessible help/tool entries
- Searchable and expandable frontend
- First working crawler for a real domain
- Support for community simplification and transparency

---

## 🔨 Epics + Key Subtasks

### 1. Modular Crawler
- [ ] Scaffold crawler base
- [ ] Implement `tools` domain crawler
- [ ] Schema-compliant JSON output
- [ ] Handle tags/lang/related_links
- [ ] Track `urls.json` per domain

### 2. JSON Schema + Validation
- [ ] Write schema definition
- [ ] Create validator script (Python)
- [ ] Validate all `entries.json`
- [ ] Add CI check (optional)

### 3. Editorial UI
- [ ] Add entry status field (draft, approved, flagged)
- [ ] UI filters by status
- [ ] Mod view (approve/edit/delete)
- [ ] Track editorial changes

### 4. Plain Language Translation
- [ ] `plain_description` field in schema
- [ ] UI toggle to view/compare
- [ ] Flag missing simplified text
- [ ] Contributor view

### 5. AI Enrichment (Optional)
- [ ] Add fields: `ai_tags`, `ai_summary`
- [ ] Generate with CLI or API
- [ ] Show enriched fields in frontend

---

## 🗺️ Visual Overview

![MVP Mindmap](https://raw.githubusercontent.com/steffolino/systemfehler/main/.github/planning/systemfehler_mvp_mindmap.png)

---

## ✅ What You Can Do

- Suggest tools, links, or missing content
- Translate or simplify texts
- Help test UI for accessibility
- Build a crawler for a new domain
