#!/bin/bash

# Usage: chmod +x create_issues_clean.sh && ./create_issues_clean.sh
# Requires GitHub CLI: https://cli.github.com/

REPO="steffolino/systemfehler"
DRY_RUN=false

create_issue() {
  local title="$1"
  local body="$2"

  echo "Creating issue: $title"

  if [ "$DRY_RUN" = false ]; then
    gh issue create --repo "$REPO" --title "$title" --body "$body" --label epic
  else
    echo "DRY RUN: gh issue create --repo="$REPO" --title="$title""
  fi
}

create_issue "Epic: Modular Crawler per Domain" "Each domain (benefits, tools, news, etc.) has its own crawling pipeline.

### Tasks
- [ ] Add crawler subfolder for aids domain
- [ ] Extend crawler pipeline to support fallback translation
- [ ] Add logging and error reporting to all crawlers
- [ ] Normalize entries.json output format across domains
"

create_issue "Epic: Unified JSON Schema + Validation" "Enforce a consistent structure across all domain entries.

### Tasks
- [ ] Create JSON Schema files in /schemas/
- [ ] Add schema validation step to crawler output
- [ ] Write test cases for malformed data detection
- [ ] Validate existing entries (manual + script)
"

create_issue "Epic: Editorial Dashboard / Moderation" "Build an admin UI to review new or flagged entries.

### Tasks
- [ ] Add status field to entries: approved, flagged, draft
- [ ] Build moderation view in frontend (Nuxt 3)
- [ ] Show source, diffs, and manual approval toggle
- [ ] Role-based access (editors vs public)
"

create_issue "Epic: Plain Language + Translator Workflow" "Allow editors to add leicht verständlich versions of entries.

### Tasks
- [ ] Add plain_description field to JSON schema
- [ ] Add contributor dashboard for translations
- [ ] Highlight missing plain_description entries in moderation UI
- [ ] Optionally link to original language version
"

create_issue "Epic: Enrichment + LLM Integration" "Enrich entries using AI and improve findability/search.

### Tasks
- [ ] Add field for llm_summary or ai_keywords
- [ ] Generate embeddings or tags for entries
- [ ] Store AI-generated prompts and context
- [ ] Build search filter using enriched metadata
"

read -p "Done. Press ENTER to exit."
