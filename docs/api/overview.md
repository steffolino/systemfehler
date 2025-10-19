# API Overview
_Last updated: 2025-10-19_

Systemfehler exposes a read-only JSON API for external tools and LLM-based retrieval.

### Base URL
```
/api/v1/
```

### Example Endpoints
| Endpoint | Description |
|-----------|--------------|
| `/search?q=query` | Full-text and faceted search |
| `/aid_offers/{id}` | Get single benefit or program |
| `/organizations/{id}` | Access contact and legal-aid info |
| `/terms` | Retrieve glossary of simplified terms |
| `/regions/{code}` | Regional view with related entries |

### Standards
- JSON:API response format  
- FDO/DOI compatibility for persistent identifiers  
- CORS-enabled for public read access
