# Risk Register
_Last updated: 2026-05-03_

### Key Risks
| Risk | Impact | Mitigation |
|-------|---------|-------------|
| Source sites block crawlers | High | Respect robots.txt, conservative crawl rate limits, seed curation, fallback discovery |
| Data removal from official pages | High | Keep canonical snapshots plus provenance and checksum history |
| Semantic misclassification in guided retrieval | High | Editorial review cases in D1 + manual life-event overrides + diagnostics |
| Weak evidence answers in sensitive topics | High | Retrieval confidence thresholds, weak-evidence signaling, no-guess fallback wording |
| Turnstile test bypass leakage into normal ops | Medium | Temporary secret only, scoped E2E usage, immediate secret cleanup after tests |
| Legal uncertainty on reuse | Medium | Source-tier policy, provenance metadata, legal review before promoting uncertain sources |
| LLM provider quota, cost, or latency pressure | Medium | Rate limiting, cache TTL tuning, retrieval-first strategy, provider-neutral fallback |

### Monitoring
- Crawl metrics and failure reasons (`data/<domain>/crawl_metrics.json`)  
- Retrieval regression suites (local and production suggested-query runs)  
- Review-case and override activity in `/api/data/life-event-review`  
- D1 health and ingestion checks in deployment workflows
