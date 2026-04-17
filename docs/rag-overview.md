# RAG Retrieval — Overview

> **Audience:** contributors, product maintainers, anyone who needs to understand
> what the information-retrieval layer does and why it is built the way it is.

---

## What problem does this solve?

Users of systemfehler ask natural-language questions about German social law —
benefit eligibility, sanctions, housing allowances, appeals, and so on.
The answers must come from legally authoritative sources, not hallucinated LLM output.

The RAG (**Retrieval-Augmented Generation**) layer finds the most relevant passages
from a curated corpus of official documents, and exposes them as grounded context
so a language model can answer accurately and cite its sources.

---

## The corpus

All source documents are catalogued in
[`data/_rag_sources/source_registry.json`](../data/_rag_sources/source_registry.json).
Every entry has machine-readable metadata: trust tier, document type, knowledge
layer, topics, target groups, and a rights statement.

Current coverage (~37 sources, ~10 000 chunks after indexing):

| Category | Examples |
|---|---|
| **SGB statutes** (full text) | SGB I, II, III, X, XII |
| **Fachliche Weisungen** | §§ 6–11 SGB II, KV/PV, RV, AufenthG |
| **BA Merkblätter** | ALG I, Bürgergeld, KV-Beiträge, Nebeneinkommen, Kurzarbeitergeld |
| **BA Forms** | Hauptantrag, Weiterbewilligung, KdU-Anlage, Anlage EK |
| **Case law** | BVerfG sanction ruling 2019 (1 BvL 7/16) |
| **NGO / research** | Sanktionsfrei.de, Sanktionsfrei study 2025, policy paper |

Local PDFs live in `data/_rag_sources/local/` **by default**, but are intentionally
excluded from git (203 MB+). Set `RAG_LOCAL_DIR` in `.env` to point at an external
directory — see `.env.example` for the recommended path.

---

## How retrieval works

Retrieval is **not** a single cosine-similarity lookup.
It is a three-stage scoring pipeline that combines semantic search with
explicit source-authority weighting and topic-sensitive boosting.

```
query text
    │
    ▼
┌─────────────────────────────────┐
│  1. Dense vector search         │  Ollama embeds the query →
│     (Qdrant cosine, 4× limit)   │  over-fetch top N × 4 results
└─────────────────────────────────┘
    │  raw_score (cosine 0–1)
    ▼
┌─────────────────────────────────┐
│  2. Source-authority weight     │  trust_tier × document_type weight
│     (compile-time constant)     │  stored on each chunk at index time
└─────────────────────────────────┘
    │  raw × source_weight
    ▼
┌─────────────────────────────────┐
│  3. Topic boost (run-time)      │  keyword match in query →
│     (query-dependent rules)     │  extra multiplier per matching rule
└─────────────────────────────────┘
    │  final_score = raw × sw × tb
    ▼
 sort ↓, trim to limit, return
```

### Stage 1 — Dense vector search

Every document is split into ~900-character overlap-aware chunks.
Each chunk is embedded with `embeddinggemma:latest` (Ollama, 768 dimensions).
At query time the query is embedded with the same model and Qdrant performs
a cosine similarity search over the entire collection.

The search fetches **4× the requested result count** so that the reranking
stages in step 2 and 3 have enough candidates to work with.

### Stage 2 — Source-authority weight

Every chunk carries a `source_weight` field set when it was indexed:

```
source_weight = trust_tier_weight × document_type_weight
```

| Trust tier | Weight | Examples |
|---|---|---|
| `tier_1_law` | 1.8 | SGB statutes, BVerfG rulings |
| `tier_2_official` | 1.5 | BA Merkblätter, Fachliche Weisungen, forms |
| `tier_3_ngo` | 1.0 | Sanktionsfrei, NGO guides |
| `tier_4_other` | 0.7 | Unverified sources |

| Document type | Weight | Rationale |
|---|---|---|
| `merkblatt` | 1.5 | Concise, verified, citizen-facing |
| `statute` / `weisung` | 1.4 | Authoritative primary source |
| `broschuere` | 1.1 | Reliable but broader |
| `formular` / `faq` | 1.0 | Useful but narrow scope |
| `guide` | 0.9 | May contain interpretation |
| `website` | 0.8 | Variable quality |

A Fachliche Weisung from the BA (`tier_2_official × weisung = 1.5 × 1.4 = 2.1`)
will outrank a NGO guide (`tier_3_ngo × guide = 1.0 × 0.9 = 0.9`) even if
the raw cosine scores are identical.

### Stage 3 — Topic boost

Some queries have a clear subject domain (sanctions, housing costs, Kindergeld, …).
A set of keyword rules detect these at query time and apply an additional
multiplier to chunks whose `document_type` or `topics` match:

| Query keywords (examples) | Matching chunks | Boost |
|---|---|---|
| `sanktion`, `pflichtverletzung` | `weisung` + `sanctions` topic | 1.35× |
| `unterkunft`, `miete`, `kdu` | `weisung` + `housing` topic | 1.35× |
| `widerspruch`, `klage`, `ablehnung` | `statute`, `weisung`, `guide` | 1.30× |
| `erwerbsfähigkeit`, `reha` | `weisung`, `statute` | 1.25× |
| `nebeneinkommen`, `freibetrag` | `weisung`, `merkblatt`, `statute` | 1.25× |
| `bürgergeld`, `grundsicherung` | `statute`, `merkblatt`, `weisung` | 1.20× |
| `arbeitslosengeld`, `alg i` | `statute`, `merkblatt` | 1.20× |
| `kindergeld`, `kind` | `formular`, `merkblatt` | 1.20× |

Multiple rules can fire simultaneously; their boosts are multiplied together
(capped at 2.0×).

**Why topic boost and not just better embeddings?**
Embeddings capture semantic similarity well but treat all documents equally.
The BVerfG sanction ruling and a general NGO guide might produce similar cosine
scores for a query about sanctions — but they are not equally authoritative.
Topic boost directs the ranking toward the most legally precise sources for
each subject area without needing a separate retrieval index.

---

## Knowledge layers

Every chunk is tagged with one of five knowledge layers.
These can be used as hard filters at search time (e.g. "only return law-tier
results"):

| Layer | What it contains |
|---|---|
| `law` | SGB statutes, constitutional rulings |
| `case_law` | Court judgments |
| `administrative_practice` | Fachliche Weisungen, forms, applications |
| `official_guidance` | BA Merkblätter, Broschüren |
| `ngo_guidance` | Civil society guides, studies |

---

## Pipeline at a glance

```
source_registry.json
       │
       ▼
   fetch / extract          local PDF  ──┐
   (fetch_docs.py)          remote PDF   ├─ pypdf
                            HTML page    │  BeautifulSoup
                                        ─┘
       │  raw text
       ▼
   normalize                 fix PDF line-wraps, remove boilerplate,
   (normalize.py)            rejoin broken words, deduplicate lines
       │
       ▼
   chunk                     section-aware split on Markdown headings
   (chunk_docs.py)           900 char max / 140 char overlap, heading preserved
       │  list[RagChunk]
       ▼
   embed + upsert            Ollama embeddinggemma:latest (768-dim)
   (index_docs.py)           Qdrant collection: rag_systemfehler (cosine)
```

Text is cached on disk (`data/_rag_cache/`) so re-indexing a source does not
re-fetch the document unless `--force` is passed.

---

## CLI quick reference

```bash
# List registered sources with weights
python -m crawlers.rag list

# Index all sources (fetch → chunk → embed → upsert)
python -m crawlers.rag index

# Re-index one source only
python -m crawlers.rag index --source-id fw_sgb2_p11 --force

# Search
python -m crawlers.rag search "Sanktionen Leistungsminderung Pflichten"
python -m crawlers.rag search "Kosten der Unterkunft Angemessenheit"

# Bulk-download PDFs from a BA downloads page
python -m crawlers.rag download-page \
  "https://www.arbeitsagentur.de/arbeitslos-arbeit-finden/downloads-arbeitslos-arbeit-finden"
```

---

## Where to go next

- [rag-deep-dive.md](rag-deep-dive.md) — full technical reference: schemas,
  scoring formulas, adding sources, environment variables
- [source-placement-policy.md](source-placement-policy.md) — hybrid placement rules for official, NGO-support, and contextual sources
- [`data/_rag_sources/source_registry.json`](../data/_rag_sources/source_registry.json) — live source list
- [`crawlers/rag/`](../crawlers/rag/) — all implementation code
