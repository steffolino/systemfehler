# Expert Pilot Testing Guide
_Last updated: 2026-05-03_

## Goal
Provide a transparent, repeatable way for domain experts to test real user scenarios, document shortcomings, and evaluate whether Systemfehler is safe and useful for advisory contexts.

## Principles For Testing
1. Test with real-world wording, not idealized keywords.
2. Prefer high-stakes scenarios where users can be harmed by missing or wrong guidance.
3. Check both answer text and evidence quality.
4. Record uncertainty and missing context explicitly.
5. Distinguish system bug, source gap, and editorial gap.

## Recommended Test Setup
1. Use production: https://systemfehler.pages.dev
2. Use guided AI search flow.
3. Keep a structured log for each test case:
   - query
   - expected user need
   - answer quality verdict
   - evidence quality verdict
   - risk level
   - recommended fix
4. Run each critical scenario in both:
   - broad wording
   - concrete wording with location or authority context

## Test Matrix (What To Test)
### A. Core Accuracy
- Does detected life-event context fit the query?
- Are key action steps factually consistent with linked evidence?
- Are crucial prerequisites and exceptions visible?

### B. Evidence Trustworthiness
- Are top sources relevant and current for the question?
- Are official and support-practical sources balanced correctly?
- Does the system avoid confident phrasing when evidence is weak?

### C. Practical Utility
- Can a stressed user identify a next step within 60 seconds?
- Are responsible offices and contact paths discoverable?
- Is language concrete enough to act on?

### D. Safety and Harm Prevention
- Does the system avoid overclaiming in legal-risk situations?
- Does it clearly signal uncertainty or weak evidence?
- Does it route users toward human counseling when needed?

### E. Language and Tone
- Is wording non-judgmental and understandable?
- Is simple language coherent, not fragmented?
- Is important nuance still preserved in simplified mode?

## Priority Scenario Buckets
1. Sanctions conflicts and appeals
2. Residence uncertainty and migration law edge cases
3. Housing loss and debt crisis escalation
4. Burnout and long-term incapacity transitions
5. Family separation and single-parent support transitions

## What To Mark As Defects
Mark as High severity if any applies:
1. Advice may cause legal or financial harm if followed.
2. Missing critical warning for a sensitive scenario.
3. Wrong authority or wrong procedural direction.

Mark as Medium severity if any applies:
1. Correct direction but missing key practical step.
2. Evidence is present but weakly connected to answer text.
3. Life-event classification is unstable across similar prompts.

Mark as Low severity if any applies:
1. Stylistic clarity issues without guidance risk.
2. Minor wording or translation quality issues.

## Transparent Current Shortcomings
These are known before pilot start:
1. Not all domains have equal editorial depth.
2. Easy-language coverage and consistency still vary.
3. Some semantic boundaries between life events need further editorial tuning.
4. Operationally stable does not mean all answer behavior is product-final.

## Planned Optimization Track
### Immediate (during pilot)
1. Apply manual life-event overrides for repeated misclassification cases.
2. Tighten weak-evidence fallback wording for sensitive topics.
3. Patch high-risk prompts and verify with targeted regression checks.

### Near-term (after pilot)
1. Expand expert-reviewed prompt and scenario fixture set.
2. Improve source-to-answer grounding checks.
3. Add reviewer analytics for override quality and durability.
4. Raise quality floor for multilingual and simple-language outputs.

## Suggested Session Format (45 minutes)
1. 5 min: context and boundaries
2. 25 min: live testing of 8 to 12 scenarios
3. 10 min: severity triage
4. 5 min: agree top 3 fix priorities

## Required Output Per Session
1. At least 8 tested scenarios
2. At least 3 high-value improvement findings
3. Severity rating for each finding
4. Clear owner recommendation:
   - retrieval tuning
   - editorial policy update
   - source gap curation
   - UX wording change
