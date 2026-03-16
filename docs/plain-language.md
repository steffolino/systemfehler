# Plain Language Guide

Systemfehler distinguishes three public reading levels:

- `Standard`
- `Einfach`
- `Leicht`

The goal is to improve comprehension without overwriting the canonical source text.

## Product Rules

- Canonical `de` content stays authoritative.
- Machine-generated plain-language text is stored separately from reviewed text.
- Reviewed `Leichte Sprache` always wins over generated fallback.
- `Einfach` and `Leicht` are different products, not one slider.

## Writing Targets

### Einfache Sprache

- Natural but noticeably clearer German.
- Short sentences.
- Explain difficult terms once.
- Keep compact paragraphs and a normal reading flow.

### Leichte Sprache

- Very short sentences.
- One idea per sentence or line.
- Explain difficult terms explicitly.
- Repeat key nouns when needed instead of unclear pronouns.
- Use signal phrases like `Das bedeutet:` or `Wichtig ist:`.

## Gold Standard Example

### Standard

`Voraussetzungen fuer Buergergeld`

`Sie koennen Buergergeld erhalten, wenn Sie erwerbsfaehig und leistungsberechtigt sind und damit mindestens folgende Bedingungen erfuellen:`

### Einfache Sprache

`Wann bekommen Sie Buergergeld`

`Sie koennen Buergergeld bekommen, wenn Sie bestimmte Bedingungen erfuellen. Sie muessen erwerbsfaehig sein. Das bedeutet: Keine Krankheit oder Behinderung hindert Sie daran zu arbeiten. Ausserdem muessen Sie hilfebeduerftig sein.`

`Folgende Bedingungen muessen Sie erfuellen:`

`Sie sind mindestens 15 Jahre alt.`

`Sie sind noch nicht im Renten-Alter.`

`Sie wohnen in Deutschland. Hier ist Ihr Lebensmittelpunkt.`

`Sie koennen mindestens 3 Stunden am Tag arbeiten.`

`Sie oder Ihre Familie brauchen Hilfe zum Leben.`

### Leichte Sprache

`Sie koennen Buerger-Geld bekommen.`

`Dafuer muessen diese Punkte stimmen:`

`Sie sind mindestens 15 Jahre alt.`

`Sie bekommen noch keine Alters-Rente.`

`Sie wohnen in Deutschland.`

`Ihr Leben ist in Deutschland.`

`Sie koennen mindestens 3 Stunden am Tag arbeiten.`

`Sie brauchen Hilfe zum Leben.`

`Das heisst:`

`Sie haben nicht genug Geld fuer das taegliche Leben.`

## Current Systemfehler MVP

- deterministic glossary-based simplification
- generated `Einfach` and `Leicht` fallbacks on entry pages
- admin audit card with rule-based findings
- public reading-mode switch

## Next Steps

- add reviewed benchmark set across multiple domains
- add AI answer mode switch using the same style rules
- add approval workflow for `*_SUGGESTED` plain-language fields
