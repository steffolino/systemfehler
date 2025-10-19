# Risk Register
_Last updated: 2025-10-19_

### Key Risks
| Risk | Impact | Mitigation |
|-------|---------|-------------|
| Source sites block crawlers | High | Respect robots.txt, rotate user agents, manual scraping backup |
| Data removal from official pages | High | Keep snapshot and archive copies |
| Wrong or outdated information | Medium | Editorial review and timestamps |
| Legal uncertainty on reuse | Medium | License field + legal review for each domain |
| Loss of funding / LLM quota | Low | Open-source fallback models and caching |

### Monitoring
- Nightly link check (HTTP 404, SSL errors)  
- Diff tracker for policy text changes  
- Dashboard showing “coverage per topic”  
- Backup to Cloudflare R2 weekly
