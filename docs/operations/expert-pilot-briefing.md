# Expert Pilot Briefing
_Last updated: 2026-05-03_

## Purpose
This pilot invites domain experts to review whether Systemfehler gives useful, safe, and evidence-grounded guidance for real-world support scenarios.

This is not a public launch. It is an expert co-review phase.

## Current Scope
- Production URL: https://systemfehler.pages.dev
- Primary user flow: guided AI search with evidence list and source links
- Data domains in use: benefits, aid, contacts, tools
- Current validated corpus scale: 1006 entries
- Latest production retrieval validation: 60/60 suggested life-event queries passed (2026-05-03)
- Human editorial controls for semantic drift are active:
  - review cases are logged
  - manual life-event overrides can be created and disabled

## What We Need From Experts
We ask experts to test realistic user journeys and identify:
1. Wrong or risky guidance
2. Missing critical context before action
3. Cases where answers sound plausible but are weakly evidenced
4. Cases where language is unclear, paternalistic, or not practical
5. Cases where users should be routed to human counseling faster

## Known Limits (Transparent)
1. Editorial quality is uneven across topics in some areas of the corpus.
2. Some multilingual and plain-language coverage remains incomplete.
3. Retrieval can still misclassify edge cases across life events.
4. Some AI answer paths remain operationally stable but product-wise experimental.
5. This system is support-oriented information, not legal representation.

## Pilot Boundaries
- Intended audience in pilot: professionals and partner org reviewers
- Not intended for broad public promotion yet
- High-sensitivity cases must be reviewed with stricter caution:
  - sanctions and appeals
  - residence status and tolerated stay
  - homelessness crisis escalation
  - acute mental health and self-harm risk contexts

## Pilot Logistics
- Pilot window recommendation: 2 to 4 weeks
- Partner target: 3 to 5 organizations
- Weekly cadence:
  - collect structured findings
  - triage by risk and reproducibility
  - apply fixes and overrides
  - re-check regression scenarios

## Success Criteria
Pilot is successful when:
1. Experts report clear practical value over baseline search.
2. No unresolved high-risk guidance defects remain open.
3. Weak-evidence handling is trusted and understandable.
4. The editorial override workflow is usable by non-developers.

## Related Documents
- Testing guide: docs/operations/expert-pilot-testing-guide.md
- Feedback rubric: docs/operations/expert-pilot-feedback-rubric.md
- Go/No-Go gates: docs/operations/expert-pilot-go-no-go.md
