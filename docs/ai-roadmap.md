# Systemfehler AI Roadmap

## Purpose

This document defines the staged integration of AI capabilities into the Systemfehler platform.

The goal is **not to build a generic chatbot**, but to use large language models (LLMs) as a **language and reasoning layer on top of structured data**.

Systemfehler remains a **data-first platform**.  
AI is used only where it improves:

- accessibility of complex information
- search usability
- editorial workflows
- data quality

---

# Core Architectural Principles

## 1. Retrieval-first architecture

AI answers must always be based on **retrieved Systemfehler data**.

Pipeline:


User query
↓
Query interpretation
↓
Search / database retrieval
↓
Evidence ranking
↓
LLM synthesis
↓
Structured response


The AI must **never invent facts outside retrieved evidence**.

---


## 2. Structured output requirement

All AI features must produce **strict JSON outputs** validated by schemas.

**Schema/data requirements (2026-03-13):**
- All `title` fields must be strings (never objects).
- All IDs must be UUID strings, not objects.
- Datetime fields must be ISO strings or `null`.
- All outputs and data are validated against canonical schemas.

Example output types:
- query rewrite
- synthesized answer
- enrichment suggestion
- duplicate detection
- moderation suggestion

This ensures:
- deterministic behavior
- testability
- UI reliability
- future interoperability with other AI systems

---

## 3. Provider abstraction

The system must not depend on a specific AI provider.

All model calls are routed through:


services/ai/llm-service.ts


Responsibilities:

- provider abstraction
- model routing
- prompt management
- schema validation
- logging
- retry logic
- cost tracking

---

## 4. Human moderation remains authoritative

AI suggestions must **never automatically modify production data**.

AI may propose:

- tags
- classifications
- missing fields
- duplicate candidates
- quality warnings

Human moderators must confirm any changes.

---

# High-Level Architecture


Frontend (React/Vite)
│
│ API calls
▼
Backend API
│
├── Search Service
│
├── AI Gateway
│ │
│ ├── Model Policy
│ ├── Prompt Library
│ ├── JSON Schemas
│ └── Telemetry
│
├── Moderation Service
│
└── Crawler / Data Pipeline


---


# Development Phases (updated 2026-03-13)

---

# Phase 1 — AI Infrastructure


Goal: establish a safe and observable AI foundation.

**Recent infra/config changes:**
- Backend and scripts now use the `PORT` environment variable for configuration (no more hardcoded ports).
- All Python and integration tests now pass with strict schema compliance.

### Deliverables

- provider-agnostic LLM gateway
- model routing policy
- JSON schema validation
- telemetry and cost tracking
- safety fallback rules

### Key issues

- Create LLM gateway service
- Implement model routing
- Add schema validation
- Add telemetry
- Implement safety fallbacks

Current repo note:

- The AI gateway scaffold exists under `backend/ai_service/`.
- Supporting RAG and LLM helper modules exist under `services/_shared/`.
- Several live GitHub issues in the `#44-#60` range still represent partial or
  unfinished work, not fully production-ready features.


### Outcome

Systemfehler can safely call AI models in a controlled way, with all outputs and data strictly validated for type and schema compliance.

No user-facing AI features yet.

---

# Phase 2 — AI Search Assistance

Goal: improve usability of search.

Many users struggle to translate real-life problems into structured queries.

### Features

AI-powered **query rewrite**

Example:

User query:


Ich habe meinen Job verloren, welche Hilfe bekomme ich jetzt?


AI rewrite:

```json
{
  "intent": "unemployment_support",
  "keywords": [
    "Arbeitslosigkeit",
    "Bürgergeld",
    "Arbeitslosengeld"
  ],
  "suggested_topics": [
    "benefits",
    "unemployment"
  ]
}
Benefits

improves search recall

supports natural language queries

reduces search friction

Phase 3 — Evidence-based AI Answers

Goal: help users understand complex social benefit rules.

Feature

AI answer synthesis based on retrieved entries.

Example pipeline:

User question
↓
retrieve matching benefits
↓
AI summarizes rules
↓
UI displays answer with sources

Example response structure:

{
  "answer": "...",
  "explanation": "...",
  "sources": [
    "entry_123",
    "entry_456"
  ]
}
Safety rules

If evidence is insufficient:

The system must respond:

"Keine verlässliche Information gefunden."


# Phase 4 — AI Editorial Assistance

Goal: improve the quality of the database.

Features (next planned work):
- AI-assisted metadata tagging
- category suggestion
- missing field detection
- duplicate detection
- quality scoring hints

Example enrichment suggestion:
{
  "suggested_tags": ["housing_support", "energy_costs"],
  "missing_fields": ["application_deadline"],
  "quality_warning": "unclear eligibility criteria"
}

Moderators review these suggestions. This phase is the next major focus after schema/data compliance and infra stabilization.

Phase 5 — Advanced AI Capabilities

Only after earlier phases are stable.

Possible future features:

conversational guidance interface

multi-step eligibility exploration

benefit comparison explanations

automated entry summaries

cross-source knowledge linking

AI-assisted data quality scoring

Cost Control Strategy

AI usage must remain cost-efficient.

Measures:

Cheap default model

Used for:

query rewriting

classification

extraction

tagging

Stronger model

Used only for:

complex synthesis

ambiguous queries

conflict resolution

Additional controls

context truncation

top-k evidence selection

prompt caching

batch processing for enrichment

token usage logging

Observability

Every AI request must log:

feature name

model used

latency

success/failure

token estimate

request timestamp

Metrics enable:

cost forecasting

feature optimization

anomaly detection

UX Guidelines

AI must be presented as assistance, not authority.

Recommended UI labels:

"Mit KI erklären"

"KI-Unterstützte Suche"

"Antwort zusammengefasst"

Avoid branding as a generic chatbot.

Trust should remain anchored in transparent data sources.

Long-term Vision

Systemfehler can become a machine-readable knowledge base for social support systems.

AI capabilities enable:

easier access for citizens

better discoverability

improved data quality

interoperability with future AI systems

The platform thus becomes both:

a public service interface

and a structured social-policy knowledge infrastructure.
