# AnarchyInTheBRD Context Pack

This folder stores offline reference material copied from a ChatGPT project so
the information is reusable inside this workspace.

Use this material with caution:

- It is not authoritative repo documentation.
- It is not a runtime configuration for Systemfehler.
- It should not override verified project-specific code or docs.
- Domain lists and prompts should be treated as starter material and reviewed
  before operational use.

Contents:

- `project-context.yaml`
  High-level project framing, research priorities, and source-order guidance.
- `seed-domains.json`
  Reusable allowlist grouped by source class.
- `crawl-policy.yaml`
  Starter crawling and retrieval policy.
- `system-prompt.txt`
  Starter assistant prompt for a VS Code / RAG workflow.

Recommended use:

- Reuse as reference when building a separate research assistant or crawler.
- Copy selectively into a dedicated project, not directly into production
  Systemfehler pipelines without review.
