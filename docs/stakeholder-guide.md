# Systemfehler – Stakeholder Guide

Welcome. This document is for you if you care about social services, data transparency, or accessible information—and you want to understand or support Systemfehler, without needing technical skills.

---

## 1. The Problem

Information about social support in Germany is scattered, fragmented, and fragile.

- **It's hard to find.** Eligibility rules, deadlines, amounts, and application processes are spread across dozens of government websites, often in complex language.
- **It disappears.** When public agencies update their websites, old information vanishes—even if it was important for understanding eligibility or historical context.
- **It's not accessible.** Limited availability in multiple languages and Easy German means many people cannot understand their options.
- **It's not structured.** Each agency presents information differently, making it hard to compare, analyze, or use programmatically.

This creates barriers for:

- **People seeking support** – they struggle to find what they're eligible for.
- **NGOs and advisors** – they spend resources duplicating information-gathering work.
- **Researchers and policy makers** – they lack structured data to analyze how services evolve and who is served.
- **Public administration** – they have limited visibility into the fragmented landscape they manage.

---

## 2. What Is Systemfehler?

Systemfehler is a **long-term, open data infrastructure** that collects, normalizes, preserves, and shares information about social services.

Think of it as a **living archive and reference database** rather than a consumer-facing website (though consumer interfaces could be built on top of it).

### Core Principles

**Preservation**: Information is stored with timestamps. When official sources change or remove content, Systemfehler keeps earlier versions. This makes it possible to study how services have evolved.

**Transparency**: All data is openly accessible. You can see what information we have, how it has changed, and where it came from.

**Accessibility**: The platform supports multiple languages and Easy German (Leichte Sprache) from the outset. Information should not be locked behind complex language.

**Interoperability**: Data is structured using clear schemas and taxonomies. This allows reuse—by NGOs, government portals, chatbots, research projects, and future tools we haven't imagined yet.

**Human oversight**: Information is never published directly from automated crawlers. Every change goes through moderation by human experts to ensure quality and accuracy.

---

## 3. Who Benefits?

### Social Service Users and Advocates

- A **single, unified source** to understand available benefits and support programs.
- **Multilingual, accessible** information in German, English, and Easy German.
- **Historical views** to understand which programs existed and how they have changed.
- **Future tools** (search engines, chatbots, advisors) built on Systemfehler data.

### NGOs, Advisors, and Support Organizations

- **Reduced duplication**: Instead of each organization independently tracking social services, they can rely on Systemfehler as a reference.
- **Shared infrastructure**: Opportunities to integrate Systemfehler data into your own tools, websites, or advisory processes.
- **Quality baseline**: Knowing that information is actively maintained, moderated, and preserved.
- **Domain expertise needed**: Your insights and feedback directly improve data accuracy.

### Researchers and Policy Analysts

- **Historical dataset**: Track how the social service landscape has evolved over time.
- **Structured data**: Information formatted for analysis, comparison, and combination with other datasets.
- **Temporal analysis**: Understand when services were introduced, modified, or discontinued.
- **Open access**: Data is freely available for academic and policy research.

### Public Administration and Government

- **Shared reference infrastructure**: A non-partisan, transparent view of the service landscape.
- **Change monitoring**: See the impact of website updates and policy changes on the information landscape.
- **Backend for portals**: Systemfehler can serve as a data source for citizen-facing government websites.
- **Interagency coordination**: A common reference point for understanding the full social service ecosystem.

### Technologists and Tool Builders

- **API and data export**: Use structured, versioned data to build advisory tools, search engines, or decision support systems.
- **LLM-ready data**: Structured information suitable for AI-based retrieval and question answering.
- **Open source**: Architecture, tools, and workflows are openly documented.

---

## 4. How Does It Work? (High Level)

1. **Collection**: Automated crawlers regularly fetch information from public agency websites and other trusted sources.

2. **Normalization**: Raw HTML is converted into structured data using clear rules (e.g., extracting benefit amounts, eligibility criteria, deadlines).

3. **Comparison and flagging**: New information is compared against what we already know. Changes are detected and flagged for review.

4. **Human moderation**: Domain experts and moderators review proposed changes. They approve, reject, or adjust entries. An audit log records all decisions.

5. **Storage and versioning**: Approved data is stored with timestamps. Earlier versions are archived, never deleted.

6. **Scoring and quality**: Each entry receives quality scores to help identify incomplete, outdated, or unstructured information.

7. **Publishing and reuse**: Data is exported in multiple formats (JSON, CSV, API) for use by NGOs, researchers, tools, and government portals.

**You don't need to understand the technical details.** The key point: information goes through human review before publication, and nothing is ever silently discarded.

---

## 5. How Can You Get Involved?

### If You're a Domain Expert or Advisor

- **Review data accuracy**: Check whether the information we collect matches your experience and knowledge.
- **Identify missing sources**: Tell us about important organizations, programs, or resources we should be tracking.
- **Suggest improvements**: Help us understand what fields, languages, or formats would be most useful.
- **Moderate entries**: If you're interested, you can join the moderation team to review and approve information changes.

### If You Represent an Organization or Government Agency

- **Share data**: Provide structured information about your services. This accelerates accuracy and reduces redundant data collection.
- **Provide feedback**: Let us know if our collected information is outdated or incomplete.
- **Integrate**: Use Systemfehler as a backend for your own citizen-facing tools or portals.
- **Collaborate**: Partner with us to ensure data quality and coverage.

### If You Work in Research or Policy

- **Request data exports**: We can provide tailored datasets for specific analyses.
- **Contribute findings**: Share research insights and policy recommendations based on Systemfehler data.
- **Extend the platform**: Propose new domains (e.g., housing, energy, healthcare) or temporal analyses.
- **Amplify impact**: Use Systemfehler to support evidence-based policy development.

### If You're a Tool Builder or Technologist

- **Build on top**: Create accessible interfaces, search tools, or decision-support systems using Systemfehler data.
- **Contribute code**: Help improve data collection, quality scoring, or API endpoints.
- **Suggest integrations**: Recommend APIs or export formats that would support downstream tools.
- **Share implementations**: Publish examples of tools or interfaces built on Systemfehler.

### If You Care About Access and Inclusion

- **Test accessibility**: Help us ensure that information is truly accessible in multiple languages and Easy German.
- **Provide feedback**: Tell us what's working and what isn't for different audiences.
- **Share your story**: Help us understand the real-world impact of information access on your community.
- **Advocate**: Help raise awareness of the project among peers, organizations, or networks.

---

## 6. Current Status and What's Next

### Today

Systemfehler is in **early design and implementation**. We are:

- Defining the data schemas and structure.
- Building initial crawlers for key domains (benefits, aid programs, organizations, tools, contacts).
- Setting up moderation workflows and quality assurance processes.
- Documenting the architecture for contributors and partners.

### Short Term (Next 6–12 Months)

- Launch with initial domains and data.
- Establish moderation workflows and quality metrics.
- Publish open APIs and data exports.
- Recruit and train moderators and domain experts.

### Medium Term (1–2 Years)

- Expand to new domains (housing, energy, healthcare, education).
- Build reference implementations of tools (search, advisory chatbots, dashboards).
- Deepen partnerships with NGOs, government agencies, and research institutions.
- Establish sustainability model (funding, governance, community).

### Long Term

- Become a widely-used infrastructure for understanding and navigating social services.
- Enable new forms of policy analysis, citizen advisory, and social service innovation.
- Serve as a model for other countries and domains facing similar fragmentation challenges.

---

## 7. Governance and Values

Systemfehler is designed with the following commitments:

- **Open by default**: Data, code, and decisions are publicly accessible.
- **Nonprofit and non-partisan**: The project serves the public interest, not commercial or political agendas.
- **Community-driven**: Decisions involve moderators, domain experts, partner organizations, and users.
- **Preservation-focused**: Historical versions are kept; nothing is silently deleted or changed.
- **Quality-first**: Human oversight and moderation ensure accuracy and trustworthiness.
- **Extensible**: New domains, languages, and use cases can be added without redesigning the core.

---

## 8. How to Get Started

### Learn More

- Read `docs/vision.md` for strategic and long-term goals.
- Read `docs/architecture.md` if you want to understand technical design (no coding needed).
- Visit the GitHub project board to see current work and priorities.

### Connect

- **GitHub Issues**: Check open issues to see how you can contribute. Many don't require coding.
- **Discussions**: Join conversations about data, priorities, and partnerships.
- **Email or contact**: [To be provided as the project clarifies its communication channels.]

### Next Steps

1. **Introduce yourself**: Let us know who you are, what brings you here, and how you'd like to contribute.
2. **Pick a starting point**: Whether it's reviewing data, suggesting sources, moderating entries, or building tools—there's a role for you.
3. **Connect with others**: Join the community of domain experts, researchers, developers, and advocates.

---

## 9. Questions?

- **"Is this for me?"** → If you care about information access, social services, data transparency, or any of the roles described above, yes.
- **"Do I need to code?"** → No. We need domain experts, advisors, researchers, testers, and advocates as much as we need developers.
- **"Can I trust this data?"** → Data goes through human moderation before publication. We maintain an audit log of all changes and decisions. You can always see the source and provenance.
- **"How is this different from [another project]?"** → We emphasize preservation (keeping history), multilingual accessibility, human moderation, and structured data for downstream tools. We're designed for long-term infrastructure, not a specific consumer product.
- **"Will this be sustainable?"** → That's a priority. We're exploring partnerships, funding models, and community governance to ensure Systemfehler can serve the public for decades, not just years.

---

## 10. Thank You

Whether you're here to learn, contribute, partner, or simply care about making social services more transparent and accessible—thank you. The more voices, expertise, and perspectives we bring together, the better Systemfehler can serve.

We're building this together.
