# Editorial Workflow
_Last updated: 2026-05-03_

Defines how crawled data is reviewed, verified, and published.

### Roles
| Role | Permissions |
|------|--------------|
| Contributor | Suggests changes, adds sources |
| Editor | Reviews content, checks accuracy, resolves semantic review cases |
| Steward | Confirms or rejects publication |
| Admin | Manages permissions, publishes schema updates |

### Review Stages
1. **Draft** – Crawler result pending review  
2. **Review** – Editor verifies text and metadata  
3. **Approved** – Published and visible in frontend  
4. **Archived** – Outdated or replaced by policy change  

All content changes must include evidence URLs and provenance.

### Semantic Review (Life Events)

In addition to entry moderation, guided retrieval now logs ambiguous or risky
life-event classification cases for human review.

Operational surfaces:
- Admin UI: `/admin/life-events`
- API: `/api/data/life-event-review`
- D1 tables: `life_event_review_cases`, `life_event_overrides`

Lifecycle:
1. Retrieval marks a query as editorial review required (with reasons).
2. Case is stored/incremented in review queue storage.
3. Reviewer creates or updates manual override where needed.
4. Override usage is tracked and can be disabled later.
