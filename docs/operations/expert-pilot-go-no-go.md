# Expert Pilot Go-No-Go Gates
_Last updated: 2026-05-03_

## Decision Purpose
Define objective gates for moving from expert pilot to broader pilot or public beta.

## Gate Structure
A release decision is based on:
1. Safety gates (must pass)
2. Quality gates (must mostly pass)
3. Operational gates (must pass)

## Safety Gates (Mandatory)
### Gate S1: No unresolved critical harm issues
- Condition: zero open High severity findings from expert review
- Evidence: issue tracker and pilot report

### Gate S2: Sensitive-topic fallback behaves safely
- Condition: weak evidence or uncertainty is clearly communicated in high-risk topics
- Evidence: replay of sensitive test set

### Gate S3: Human escalation path is clear
- Condition: users are pointed to counseling or competent authority where needed
- Evidence: expert review notes on escalation quality

## Quality Gates
### Gate Q1: Expert rubric average
- Condition: average score at least 3.8 out of 5 across expert sessions

### Gate Q2: Minimum per-criterion floor
- Condition: no criterion average below 3.2

### Gate Q3: Practical usefulness
- Condition: at least 80 percent of tested scenarios rated actionable (score 4 or 5)

### Gate Q4: Semantic stability
- Condition: repeated prompts for same scenario do not frequently flip to unsafe misclassification

## Operational Gates (Mandatory)
### Gate O1: Production retrieval validation green
- Condition: suggested-query production suite passes at release checkpoint
- Current reference: 60/60 pass on 2026-05-03

### Gate O2: Editorial controls operational
- Condition: life-event review queue and overrides are available and actively usable

### Gate O3: Security hygiene intact
- Condition: no temporary test bypass secret remains active after test operations

## Decision Outcomes
### No-Go
Use when any mandatory safety or operational gate fails.

### Conditional Go (Expanded Expert Pilot)
Use when mandatory gates pass but quality gates are below target.
Require a dated remediation plan before expansion.

### Go (Public Beta Candidate)
Use when all mandatory gates pass and quality gates meet targets for at least two consecutive review cycles.

## Required Artifacts For Decision Meeting
1. Expert pilot briefing and scope
2. Testing logs and severity triage
3. Rubric score summary
4. Open vs closed findings report
5. Updated risk register and mitigation owners

## Recommended Decision Cadence
- Weekly pilot triage
- Formal Go-No-Go checkpoint every 2 weeks
- Final decision after minimum 2 complete expert cycles
