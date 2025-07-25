# Data and Naming Conventions

## JSON Entry Format (Simplified)

Each `entries.json` file should contain a list of objects with:

```json
{
  "id": "uuid-or-hash",
  "lang": "de",
  "title": "Name of the offer or tool",
  "description": "Short accessible explanation",
  "source_url": "https://...",
  "tags": ["topic", "audience", "format"],
  "related_links": [
    {
      "label": "Antrag online",
      "url": "https://...",
      "lang": "de"
    }
  ]
}
```

---

## Naming and File Layout

- Use `snake_case` for filenames.
- `entries.json`: list of structured entries.
- `urls.json`: known sources for crawling/monitoring.
- `meta.json`: update timestamps, version status.

---

## Language and Accessibility

- Always include `lang` field (ISO 639-1 or -3).
- Prefer plain language (`leicht verständlich`).
- Avoid passive and bureaucratic tone.
- Add emojis only if they assist in clarity or emotion.

---

## LLM-Readiness

- Keep structures flat and self-contained.
- Avoid references that require external state or schemas.
- Translate or simplify where possible.
