# Easy German & Multilingual Support — Implementation Plan (English)

## Summary

Objective: provide accessible, preserved translations and simplified (Easy German / "Leichte Sprache") variants for content stored in Systemfehler, integrating generation, storage, moderation, and UI access while preserving provenance.

## Scope
- Generate and store simplified German (de-LEICHT) and additional language translations for core fields (title, summary, body, eligibility).
- Preserve translations alongside original snapshots and retain them when source pages are removed.
- Provide API/UI toggles to request translations and Easy German views.

## Data model changes
- Add `translations` object to core entry schema:

```json
"translations": {
  "de-LEICHT": {
    "title": "...",
    "summary": "...",
    "body": "...",
    "provenance": { "method": "llm|rule|human|mt", "generator": "model-name-or-tool", "timestamp": "..." },
    "reviewed": false
  },
  "en": { ... }
}
```

- Each translation stored as part of the entry snapshot with timestamps and provenance.

## Generation pipeline (high level)
1. Trigger: on new entry ingestion, significant update, or manual request.
2. Extract canonical text fields and normalize HTML to plain text.
3. Strategy: prefer a deterministic rule-based simplifier for Easy German where feasible; otherwise run an LLM rewrite with a strict prompt for simplification and fidelity. For other languages prefer MT with post-editing or LLM rephrase.
4. Post-processing: enforce length limits, remove hallucinations by checking for unsupported factual assertions (compare to source), and compute a basic quality score.
5. Store result under `translations` with `provenance` and enqueue for human review in moderation queue.

## Moderation & review
- Add translation review items to moderation queue with diffs against source and confidence metadata.
- Allow reviewers to accept, edit, or reject translations. Accepted translations are flagged `reviewed: true` and used in public exports.

## API and UI integration
- API: support `?lang=de-LEICHT` and `?lang=auto` query params on entry endpoints; `Accept-Language` fallback.
- Export: include translations and provenance in temporal exports and dataset snapshots.
- UI: a language toggle and an Easy German switch; show provenance and a gentle "this text was simplified" notice.

## Preservation behaviour
- When source content is removed or changed, keep translations attached to the preserved snapshot that generated them.
- If a translation was derived from an older source, the snapshot should include both source and translation provenance.

## Acceptance criteria
- Schema updated with `translations` and validators updated to accept translation objects.
- Pipeline can generate a de-LEICHT variant for a sample set of 100 entries with >70% reviewer acceptance in initial pilot.
- API returns translations when requested and exports include translation data and provenance.

## Milestones
1. Design schema extension and validators — 1 week.
2. Implement generation pipeline prototype (LLM + rule fallback) — 2 weeks.
3. Integrate moderation review path and UI toggle — 1-2 weeks.
4. Pilot on 100 entries and measure reviewer acceptance — 2 weeks.

## Risks & mitigations
- Risk: hallucination from LLMs — mitigate with strict prompts, post-checks against source, and human review.
- Risk: translation costs — mitigate with hybrid strategy (rule-based + MT) and configurable generation limits.

---

If this plan looks good I can: (A) open a draft schema PR, (B) implement a prototype generator into `crawlers/shared` and wire a moderation task, or (C) start the pilot run on a small dataset. Which should I do next?
