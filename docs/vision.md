# Systemfehler – Vision and Strategic Context

## 1. Background

Information about social services in Germany is fragmented across many websites, often presented in complex language and frequently changed or removed. People who rely on these services face high barriers when trying to understand what support exists, who is eligible, and how to apply.

At the same time, institutions, NGOs, and researchers lack a unified, structured view of the social service landscape and how it changes over time.

---

## 2. Vision

Systemfehler is designed as a long-lived, open data infrastructure for social services. It aims to:

- Aggregate and normalize information about benefits, aid programs, and supporting organizations.
- Preserve information even when it is removed, changed, or simplified on the original sites.
- Provide transparent, structured, multilingual views on social service provision.
- Enable downstream tools such as search portals, advisory chatbots, dashboards, and research analyses.

The core idea is: **information about rights and social support should not silently disappear.**

---

## 3. Objectives

1. **Preservation**

   Systemfehler keeps historical versions of service information, including eligibility rules, deadlines, and amounts. When official sites change or remove content, Systemfehler still stores the earlier versions with clear timestamps.

2. **Accessibility**

   The project supports multiple languages and Easy German (Leichte Sprache) to make information more understandable and inclusive.

3. **Transparency**

   By tracking changes over time, Systemfehler makes it visible which benefits are introduced, modified, or discontinued. This enables public debate, evaluation, and policy analysis.

4. **Interoperability**

   Data is modeled using explicit schemas, taxonomies, and quality scores. This allows reuse by other systems: websites, NGOs, municipal portals, research projects, and AI-based tools.

5. **Extensibility**

   New domains (e.g. housing, energy, healthcare, education) can be added to the platform without redesigning the core architecture.

---

## 4. Key Features for Stakeholders

### 4.1 For Social Service Users and NGOs

- A unified, structured overview of relevant benefits and aid programs.
- Clear indication of deadlines and validity periods.
- Preserved multilingual content even if the original site no longer provides it.
- Potential future UIs that allow search by location, target group, and situation.

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

Over time, Systemfehler can grow beyond a proof of concept into:

- A stable, widely-used dataset for social services and related support structures.
- A technical foundation for digital advisory assistants and inclusive service navigation tools.
- A living archive documenting how access to social services evolves.

The technical decisions (schema-based approach, modular crawlers, moderation workflows, and quality metrics) are aligned with this long-term vision. They ensure that the system can adapt to new requirements while preserving the integrity and history of the data it stores.
