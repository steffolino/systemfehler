# Content Contract v1
_Last updated: 2025-10-19_

Defines the structure of benefit-related data across all content types (aid offers, benefits, tools, forms, etc.).  
All records inherit from a shared **BaseEntity**, ensuring consistent metadata and FDO-ready identifiers.

### BaseEntity fields
| Field | Type | Description |
|--------|------|-------------|
| id | UUID | Persistent unique ID |
| title | string | Display title (DE/EN) |
| summary | string | Short description |
| content | text | Main extracted text |
| url | string | Source URL |
| topic | string[] | Normalized taxonomy terms |
| valid_from / valid_until | date | Policy validity |
| status | enum | active / replaced / under_revision |
| source_updated_at | datetime | Crawl timestamp |
| provenance | object | Domain + checksum + crawl ID |
| fdo_id | string | Future persistent ID |

### Entity Extensions
- `aid_offer`: includes eligibility, contact, form_link
- `benefit`: includes amount, duration, and deadline fields
- `organization`: includes region, type, contact info
- `term`: glossary entry with multilingual labels
