# RAG Pipeline — Technical Reference

> **Audience:** developers modifying the retrieval pipeline, adding new sources,
> or integrating the search results into a downstream LLM call.
>
> Start with [rag-overview.md](rag-overview.md) for the conceptual picture.

---

## Module map

```
crawlers/rag/
├── __main__.py         entry point: python -m crawlers.rag <cmd>
├── cli.py              subcommand wiring + download-page helper
├── schemas.py          Pydantic models: RagSource, RagDocument, RagChunk
├── sources.py          registry loader, source_weight computation, topic boost rules
├── fetch_docs.py       legacy direct fetcher (local_file / pdf / html)
├── extract.py          low-level text extractors (PDF, HTML, plain text)
├── normalize.py        PDF artifact removal, line-wrap repair, deduplication
├── chunk_docs.py       section-aware chunking (heading detection + overlap splits)
├── ingest.py           orchestration: fetch → extract → normalize → chunk
└── index_docs.py       OllamaEmbedder + RagIndexer (embed + upsert + search)
```

---

## Data flow in detail

### 1. Source registry → `RagSource`

**File:** `data/_rag_sources/source_registry.json`
**Loader:** `crawlers/rag/sources.py → load_registry()`

Each entry becomes a `RagSource` Pydantic object.
`compute_source_weight(source)` is called immediately after loading
and the result is written to `source.source_weight`:

```python
source_weight = _TRUST_WEIGHTS[source.source_trust_level]  # 0.7 – 1.8
              × _DOCTYPE_WEIGHTS[source.document_type]     # 0.7 – 1.5
```

This value is stored with every chunk so the search path never has to
look up the source again.

**Weight tables (current values):**

```
TRUST TIER WEIGHTS          DOCUMENT TYPE WEIGHTS
tier_1_law        1.8       merkblatt      1.5
tier_2_official   1.5       statute        1.4
tier_3_ngo        1.0       weisung        1.4
tier_4_other      0.7       broschuere     1.1
                            formular       1.0
                            faq            1.0
                            guide          0.9
                            website        0.8
                            other          0.7
```

**Effective weight examples:**

| Source | Trust | DocType | Weight |
|---|---|---|---|
| SGB II statute (BA PDF) | tier_1_law (1.8) | statute (1.4) | **2.52** |
| FW SGB II §11 | tier_2_official (1.5) | weisung (1.4) | **2.10** |
| BA Merkblatt ALG I | tier_2_official (1.5) | merkblatt (1.5) | **2.25** |
| Sanktionsfrei guide | tier_3_ngo (1.0) | guide (0.9) | **0.90** |

---

### 2. Fetch + extract → raw text

**Dispatcher:** `crawlers/rag/ingest.py → _fetch_raw(source)`

| `source_type` | Dispatcher | Implementation |
|---|---|---|
| `local_file` | `extract.extract(source.url)` with path detection | `extract.extract_pdf(path)` |
| `pdf` / remote `.pdf` URL | `extract.extract(url)` | `extract.extract_pdf(url)` via HTTP |
| `html` | `extract.extract(url)` | `extract.extract_html(url)` |

`extract.py` does not cache. `ingest.py` wraps it with a disk cache at
`data/_rag_cache/{source_id}_{md5(url)[:12]}.txt` (or `.pdf` for binary).

**Pass `--force`** to bypass the cache and re-fetch.

PDF text is extracted with `pypdf`. Scanned images inside PDFs produce empty
pages — the pipeline silently skips blank pages. The BA PDF corpus is
all native/selectable text so this is not an issue in practice.

HTML extraction uses `BeautifulSoup` with the `lxml` parser; `<script>`,
`<style>`, and nav elements are stripped before text extraction.
**Important:** pages that require JavaScript rendering (e.g. `gesetze-im-internet.de`)
return only navigation markup — use local PDF sources instead.

---

### 3. Normalize

**File:** `crawlers/rag/normalize.py → normalize(text) -> str`

Applied after every fetch:

1. **`_remove_pdf_artifacts`** — strips page-number lines (`Seite 3 von 12`,
   `- 3 -`) and any line that repeats 4+ times across the document
   (running headers / footers).
2. **`_fix_broken_line_wraps`** — rejoins lines that end without sentence
   punctuation and are followed by a lowercase letter. Skips Markdown
   heading lines and paragraph breaks.
3. Whitespace collapse — normalises multiple blank lines to one, strips
   trailing whitespace.

`content_hash(text)` returns a SHA-256 hex digest used to detect unchanged
documents on re-ingest.

---

### 4. Chunk

**File:** `crawlers/rag/chunk_docs.py → chunk_document(doc) -> list[RagChunk]`

**Default parameters:** `max_chars=900`, `overlap_chars=140`

Two-pass algorithm:

**Pass 1 — section parsing (`_parse_sections`):**
Splits normalized text on Markdown headings (`#`, `##`, `###`, `####`).
Each section keeps its heading as `section.heading`.
If no headings are found, the entire document is treated as one section.

**Pass 2 — fixed-overlap splitting per section:**
Within each section, a sliding window advances by `max_chars - overlap_chars`
(760 chars) per step, with the last `overlap_chars` (140 chars) of the
previous chunk prepended to the next. This preserves sentence continuity
across chunk boundaries.

Each `RagChunk` carries:
- `chunk_id`: `"{document_id}-c{index:04d}"`
- `section_title`: nearest heading (empty for preamble)
- `char_start` / `char_end`: byte offsets in the original normalized text
- `chunk_index` / `total_chunks`: position within the document
- Full provenance copied from `RagDocument`: title, url, source_name,
  source_trust_level, document_type, knowledge_layer, topics, target_groups,
  license_or_rights
- `source_weight`: pre-computed at this stage

---

### 5. Embed + upsert

**File:** `crawlers/rag/index_docs.py`

**`OllamaEmbedder`:**
- Calls `POST /api/embed` with `{"model": model, "input": [text1, …]}`
- Batches in groups of 32 (default)
- 3 retries with back-off (0.8 s, 1.6 s) before raising
- Truncates input to 8 000 chars, strips null bytes

**`RagIndexer.index_chunks`:**
- Calls `ensure_collection()` on first run: bootstraps a calibration
  embedding to determine vector size, then creates the Qdrant collection
  with `Distance.COSINE`.
- Point ID: deterministic integer from `int(sha1(chunk_id)[:16], 16)` —
  re-indexing the same chunk is an idempotent upsert.
- All chunk fields are stored as Qdrant payload (see payload schema below).

**Environment variables:**

| Variable | Default | Description |
|---|---|---|
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama instance |
| `OLLAMA_EMBED_MODEL` | `embeddinggemma:latest` | Embedding model name |
| `QDRANT_URL` | `http://localhost:6333` | Qdrant instance |
| `RAG_LOCAL_DIR` | `data/_rag_sources/local/` (inside repo) | Absolute path to the local PDF corpus. Set this when the PDFs live outside the repository (recommended). |

**Current embedding model:** `embeddinggemma:latest` — 768-dimensional vectors.
If you switch models you **must** drop and recreate the collection
(`DELETE /collections/rag_systemfehler`) because vector dimensions must match.

---

### 6. Search (retrieval)

**`RagIndexer.search(query, limit=8, knowledge_layers=None, topics=None)`**

```
1. embed(query) → query_vector

2. qdrant.query_points(
       collection=rag_systemfehler,
       query=query_vector,
       filter=Filter(must=[...optional layer/topic filters]),
       limit=limit * 4,      ← over-fetch for reranking headroom
       with_payload=True,
   )

3. For each result point:
       raw   = point.score                           # cosine (0–1)
       sw    = payload["source_weight"]              # pre-computed at index time
       tb    = topic_boost_for_query(query, payload) # run-time rule matching
       score = raw × sw × tb                         # final ranking score

4. Sort by score descending, return first `limit` records.
```

Each returned dict contains all payload fields plus:
- `score` — final combined score
- `raw_score` — original cosine similarity
- `source_weight_applied` — the sw multiplier used
- `topic_boost_applied` — the tb multiplier used

---

### 7. Topic boost rules

**File:** `crawlers/rag/sources.py → TOPIC_BOOST_RULES`

```python
def topic_boost_for_query(query: str, chunk_payload: dict) -> float:
    q = query.lower()
    doc_type = payload["document_type"].lower()
    topics   = payload["topics"]               # list[str]

    combined = 1.0
    for rule in TOPIC_BOOST_RULES:
        if not any(kw in q for kw in rule["keywords"]):
            continue
        if doc_type in rule["document_types"] or any(t in topics for t in rule["topics"]):
            combined *= rule["boost"]

    return min(combined, 2.0)
```

Rules fire **independently** — a query containing both `sanktion` and
`widerspruch` will stack a 1.35× sanctions boost with a 1.30× legal-remedy
boost on a `weisung` chunk with `sanctions` + `legal_remedies` topics,
yielding `1.35 × 1.30 = 1.755×` (before the 2.0 cap).

Full rule table:

| Trigger keywords | Matching doc_types | Matching topics | Boost |
|---|---|---|---|
| `sanktion`, `leistungsminderung`, `meldeversäumnis`, `pflichtverletzung` | `weisung` | `sanctions` | 1.35× |
| `unterkunft`, `kdu`, `miete`, `wohnen`, `heizung`, `angemessen` | `weisung` | `housing` | 1.35× |
| `widerspruch`, `klage`, `rechtsmittel`, `bescheid`, `ablehnung` | `statute`, `weisung`, `guide` | `legal_remedies`, `financial_support` | 1.30× |
| `erwerbsfähigkeit`, `arbeitsunfähig`, `krankheit`, `reha` | `weisung`, `statute` | `health`, `rehabilitation` | 1.25× |
| `nebeneinkommen`, `hinzuverdienst`, `freibetrag`, `einkommen` | `weisung`, `merkblatt`, `statute` | `financial_support`, `employment` | 1.25× |
| `bürgergeld`, `sgb ii`, `grundsicherung`, `alg ii` | `statute`, `merkblatt`, `weisung` | `financial_support`, `employment` | 1.20× |
| `arbeitslosengeld`, `alg i`, `sgb iii`, `arbeitslos` | `statute`, `merkblatt` | `employment` | 1.20× |
| `kindergeld`, `familienkasse`, `kind` | `formular`, `merkblatt` | `family`, `child_benefit` | 1.20× |

To add a rule, append a dict to `TOPIC_BOOST_RULES` in `sources.py`.
No schema change needed; the rule is applied at query time.

---

## Qdrant payload schema

Every point stored in the `rag_systemfehler` collection has this payload:

```jsonc
{
  "chunk_id":            "sgb2-c0042",
  "document_id":         "sgb2",
  "source_id":           "sgb2",
  "title":               "SGB II – Bürgergeld, Grundsicherung für Arbeitsuchende",
  "section_title":       "§ 22 Bedarfe für Unterkunft und Heizung",
  "url":                 "data/_rag_sources/local/sgb2_ba037135.pdf",
  "source_name":         "Bundesagentur für Arbeit (BA-Textausgabe)",
  "source_trust_level":  "tier_1_law",
  "document_type":       "statute",
  "knowledge_layer":     "law",
  "language":            "de",
  "jurisdiction":        "DE",
  "topics":              ["financial_support", "employment", "housing", "sanctions"],
  "target_groups":       ["unemployed", "general_public"],
  "publication_date":    null,
  "license_or_rights":   "Datenlizenz Deutschland v2.0",
  "text":                "§ 22 Absatz 1 …",     // the chunk text
  "char_start":          34210,
  "char_end":            35104,
  "chunk_index":         42,
  "total_chunks":        413,
  "source_weight":       2.52
}
```

---

## Source registry schema

Minimal required fields for a new entry:

```jsonc
{
  "id":                "my_source",          // unique, slug-style
  "title":             "Human-readable title",
  "url":               "data/_rag_sources/local/my_file.pdf",   // or https://...
  "source_name":       "Issuing authority",
  "source_type":       "local_file",         // local_file | pdf | html
  "source_trust_level": "tier_2_official",
  "document_type":     "merkblatt",
  "knowledge_layer":   "official_guidance",
  "language":          "de",
  "jurisdiction":      "DE",
  "topics":            ["financial_support"]
}
```

Optional but strongly recommended: `license_or_rights`, `target_groups`, `notes`.

After editing the registry, re-index only the new source:

```bash
python -m crawlers.rag index --source-id my_source
```

---

## How to add a new source

1. **Place the file** in `data/_rag_sources/local/` (for PDFs) or note the URL.
2. **Append an entry** to `data/_rag_sources/source_registry.json`.
   Set `source_trust_level`, `document_type`, and `knowledge_layer` accurately —
   these drive ranking.
3. **Index it:**
   ```bash
   python -m crawlers.rag index --source-id <new_id>
   ```
4. **Verify:**
   ```bash
   python -m crawlers.rag search "keyword from the new document"
   ```
   Check that the new source appears in results with reasonable scores.
5. If the new document covers a topic not yet in `TOPIC_BOOST_RULES`,
   add a rule in `crawlers/rag/sources.py`.

---

## Full re-index procedure

```powershell
# 1. Set RAG_LOCAL_DIR in .env to point at the PDF corpus
#    (already done if you followed the setup guide)

# 2. Clear text cache (forces re-extraction from all sources)
Remove-Item data\_rag_cache\*.txt -Force

# 3. Drop the Qdrant collection
Invoke-RestMethod -Uri http://localhost:6333/collections/rag_systemfehler -Method Delete

# 4. Re-index everything
.venv311\Scripts\python.exe -m crawlers.rag index
```

Indexing time is dominated by Ollama embedding throughput.
Expect ~2–5 minutes for the full corpus on a local GPU; longer on CPU-only.

---

## CLI reference

```
python -m crawlers.rag list
    List all registered sources with computed source_weight.

python -m crawlers.rag index [--source-id ID [ID ...]] [--force]
    Ingest, embed, and upsert into Qdrant.
    --source-id  only process these source IDs
    --force      bypass disk cache (re-fetch even if cached)

python -m crawlers.rag search "QUERY" [--limit N]
    [--layers LAYER [LAYER ...]]   filter by knowledge_layer
    [--topics TOPIC [TOPIC ...]]   filter by topic tag
    Performs semantic search and prints ranked results with score breakdown.

python -m crawlers.rag download-page URL [URL ...] [--out DIR] [--force]
    Scrape all .pdf links from the given page(s) and download them.
    Default output: data/_rag_sources/local/
    --force  overwrite existing files
```

---

## Known limitations and future work

| Issue | Status | Notes |
|---|---|---|
| No BM25 / sparse retrieval | Planned | True hybrid (dense + sparse) would improve recall on exact legal citations like `§ 22 Abs. 1 Satz 4 SGB II`. Could add Qdrant sparse vectors. |
| No query expansion | Planned | German legal abbreviations (`KdU`, `FW`, `ALG`) could be expanded before embedding. |
| Encrypted PDFs skipped | Known | `fw-sgb-i-sgb-x_ba022125.pdf` requires `cryptography>=3.1`. Not in registry. |
| `pypdf` "Ignoring wrong pointing object" warnings | Benign | Seen on malformed but readable PDFs. Extraction can still succeed; e.g. `sanktionsfrei_studie_2025` (36 chunks) and `policy_paper_sanktionen` (12 chunks) indexed correctly. |
| JS-rendered HTML sources | Avoided by design | BA law text pages use JS rendering. Replaced with local PDFs. |
| No freshness tracking | Future | `publication_date` field exists; no automated staleness check yet. |
| Multilingual queries | Untested | Model is German-trained; cross-lingual retrieval for non-German queries is untested. |
