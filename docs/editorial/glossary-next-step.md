# Editorial Glossary Next Step

Status: planned

The Sources page and related editorial/admin views need a separate, clean glossary before further UI polish. The current interface exposes backend/editorial terms without enough explanation, which makes the page confusing and undermines source transparency.

## Goal

Create one glossary that defines public-facing, editorial, and backend/source-quality terms in plain German and English. Public UI should use the glossary labels and explanations instead of raw internal values.

## Terms That Need Clear Definitions

- Quelle: the organization, website, or publisher from which information comes.
- Eintrag: one stored information record/page in our dataset, derived from a source.
- Bereich: the functional category where an entry is used, such as Leistungen, Hilfen, Tools, Organisationen, Kontakte.
- Leistung: a benefit, entitlement, or formal support route.
- Hilfe: practical or advisory support.
- Tool: calculator, finder, form, portal, or other interactive/practical online route.
- Kontakt: concrete office, hotline, counselling point, or finder for direct contact.
- Organisation: institution or provider represented as a structured entity.
- Amtliche Info: official or official-adjacent source suitable for authoritative first orientation.
- Gepruefte Hilfe: reviewed NGO, counselling, watchdog, or practical support source.
- Kontext: contextual/background source, not primary authority for user-facing advice.
- source tier / tier_1_official / tier_2_ngo_watchdog etc.: internal quality classification; should be translated or hidden in normal public UI.
- institution type / government / ngo / academic / partisan: editorial source classification; should be explained only in detail views.
- source registry: curated list of known source domains and their quality metadata.
- source site context: sitemap/meta-derived overview of what a source domain appears to cover.
- provenance: record of where an entry came from and how it was crawled/curated.

## Product Requirements

- The public Sources page must not show raw internal enum values as primary labels.
- Every visible category/count must say what it counts.
- If "Quellen gesamt" says 35, the page must show 35 source cards, not domain-expanded duplicates.
- Source cards should show public labels first and technical metadata only in an expandable details area.
- German labels must be complete and human-readable; English labels should also exist.
- Glossary language should be reused consistently across UI, docs, source audit reports, and editorial review tools.

## Implementation Follow-up

1. Create a structured glossary file, likely `data/_taxonomy/glossary.json` or `data/_sources/source_terms.json`.
2. Add German and English labels plus one-sentence explanations.
3. Replace hard-coded Sources page labels with glossary-backed labels.
4. Move backend terms such as `tier_1_official` and `government` into expandable technical details.
5. Add a small regression check so public UI does not expose raw tier/institution enum values accidentally.
