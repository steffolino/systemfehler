# systemfehler – GitHub Epics & Issues

This planning document contains high-level **epics** and their associated **issues** for the systemfehler project.

---

## 1. Modular Crawler per Domain

**Goal**: Each domain (`benefits`, `tools`, `news`, etc.) has its own crawling pipeline.

### 1.1 Tasks
- [ ] Add crawler subfolder for `aids` domain
- [ ] Extend crawler pipeline to support fallback translation
- [ ] Add logging and error reporting to all crawlers
- [ ] Normalize `entries.json` output format across domains

---

## 2. Unified JSON Schema + Validation

**Goal**: Enforce a consistent structure across all domain entries.

### 2.1 Tasks
- [ ] Create JSON Schema files in `/schemas/`
- [ ] Add schema validation step to crawler output
- [ ] Write test cases for malformed data detection
- [ ] Validate existing entries (manual + script)

---

## 3. Editorial Dashboard / Moderation

**Goal**: Build an admin UI to review new or flagged entries.

### 3.1 Tasks
- [ ] Add status field to entries: `approved`, `flagged`, `draft`
- [ ] Build moderation view in frontend (Nuxt 3)
- [ ] Show source, diffs, and manual approval toggle
- [ ] Role-based access (editors vs public)

---

## 4. Plain Language + Translator Workflow

**Goal**: Allow editors to add `leicht verständlich` versions of entries.

### 4.1 Tasks
- [ ] Add `plain_description` field to JSON schema
- [ ] Add contributor dashboard for translations
- [ ] Highlight missing `plain_description` entries in moderation UI
- [ ] Optionally link to original language version

---

## 5. Enrichment + LLM Integration

**Goal**: Enrich entries using AI and improve findability/search.

### 5.1 Tasks
- [ ] Add field for `llm_summary` or `ai_keywords`
- [ ] Generate embeddings or tags for entries
- [ ] Store AI-generated prompts and context
- [ ] Build search filter using enriched metadata
