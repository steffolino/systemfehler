# Content Contract v1
_Last updated: 2026-05-03_

Defines the shared contract used across all domains (`benefits`, `aid`,
`tools`, `organizations`, `contacts`).

Authoritative schema location:
- `data/_schemas/`

Canonical snapshot format:
- `data/<domain>/entries.json`

### BaseEntity fields
| Field | Type | Description |
|--------|------|-------------|
| id | UUID | Persistent unique ID |
| title | string | Primary display title |
| summary | object | Language-keyed summary text (for example `de`) |
| content | object | Language-keyed main text (for example `de`) |
| url | string | Source URL |
| topics | string[] | Normalized taxonomy terms |
| tags | string[] | Discovery/classification tags |
| targetGroups | string[] | Audience and support target groups |
| valid_from / valid_until | date | Policy validity |
| status | enum | active / replaced / under_revision |
| source_updated_at | datetime | Crawl timestamp |
| provenance | object | Domain + checksum + crawl ID |
| qualityScores | object | IQS / AIS and computation metadata |

### Entity Extensions
- `aid_offer`: includes eligibility, contact, form_link
- `benefit`: includes amount, duration, and deadline fields
- `organization`: includes region, type, contact info
- `term`: glossary entry with multilingual labels

### Validation Rule

All new or changed records must validate against JSON schema contracts before
promotion or import.

Recommended checks:
- `npm run validate`
- `python crawlers/cli.py validate --domain <domain>`
