# Systemfehler – Vision and Strategic Context

For a non-technical German overview, see
[`docs/ueberblick.md`](ueberblick.md).

## 1. Background

Information about social services in Germany is fragmented across many websites, often presented in complex language and frequently changed or removed. People who rely on these services face high barriers when trying to understand what support exists, who is eligible, where trustworthy information comes from, and where they can find appropriate help.

At the same time, institutions, NGOs, and researchers lack a unified, structured view of the social service landscape and how it changes over time.

---

## 2. Vision

Systemfehler is designed as a first point of information and orientation, backed by long-lived open data infrastructure for social services. It aims to:

- Help users get an understandable first overview of possible rights, benefits, support routes, and next steps.
- Aggregate and normalize information about benefits, aid programs, and supporting organizations.
- Act as a transparent information hub that points users to official sources, trusted tools, contact points, and specialist advice finders.
- Preserve information even when it is removed, changed, or simplified on the original sites.
- Provide transparent, structured, multilingual views on social service provision.
- Enable downstream tools such as search portals, advisory chatbots, dashboards, and research analyses.

The core idea is: **people should be able to find, understand, verify, and act on information about social rights and support.**

---

## 3. Objectives

1. **Preservation**

   Systemfehler keeps historical versions of service information, including eligibility rules, deadlines, and amounts. When official sites change or remove content, Systemfehler still stores the earlier versions with clear timestamps.

2. **Accessibility**

   The project supports multiple languages and Easy German (Leichte Sprache) to make information more understandable and inclusive.

3. **Orientation**

   Systemfehler helps users move from a vague situation or question to concrete next steps: relevant information, useful source links, practical tools, contact points, and trusted external advice routes. It is not a replacement for legal or social counseling; it is a clear starting point.

4. **Transparency**

   By tracking changes over time, Systemfehler makes it visible which benefits are introduced, modified, or discontinued. This enables public debate, evaluation, and policy analysis.

5. **Interoperability**

   Data is modeled using explicit schemas, taxonomies, and quality scores. This allows reuse by other systems: websites, NGOs, municipal portals, research projects, and AI-based tools.

6. **Extensibility**

   New domains (e.g. housing, energy, healthcare, education) can be added to the platform without redesigning the core architecture.

---

## 4. Key Features for Stakeholders

### 4.1 For Social Service Users and NGOs

- A unified, structured overview of relevant benefits and aid programs.
- A first-line orientation layer that helps users understand what may be relevant before they contact an authority or advice center.
- Clear indication of deadlines and validity periods.
- Practical pathways to further help, including contact points, official portals, nonprofit support sources, and specialist advice finders.
- Preserved multilingual content even if the original site no longer provides it.
- A public AI-guided search interface with `Standard` and `Einfach` answer modes at `systemfehler.pages.dev`; `Leicht` remains part of reviewed entry-data/admin plain-language workflows.
- Future tools can also be built on Systemfehler data (search by location, target group, situation).

### 4.2 For Researchers and Policy Analysts

- Historical snapshots showing how services have evolved.
- Temporal exports of the dataset for analysis.
- Data suited for combining with other statistical and socio-economic indicators.

### 4.3 For Public Administration and Partners

- A shared reference infrastructure for understanding the information landscape.
- A way to monitor the impact of changes to official websites.
- Opportunities to integrate Systemfehler as a backend for citizen-facing portals.

---

## 5. Long-Term Outlook

Systemfehler has moved beyond proof of concept into a live, production platform. Over time it can grow into:

- A stable, widely-used dataset for social services and related support structures.
- A technical foundation for digital advisory assistants and inclusive service navigation tools.
- A living archive documenting how access to social services evolves.

The technical decisions (schema-based approach, modular crawlers, moderation workflows, and quality metrics) are aligned with this long-term vision. They ensure that the system can adapt to new requirements while preserving the integrity and history of the data it stores.
