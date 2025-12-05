# Create all labels first

# Epic and architecture
gh label create "epic" --color "8B5CF6" --description "Large initiative spanning multiple issues"
gh label create "architecture" --color "0EA5E9" --description "Architecture and design decisions"
gh label create "data" --color "10B981" --description "Data model and schema work"

# Crawler
gh label create "crawler" --color "F59E0B" --description "Web crawler and scraping"
gh label create "backend" --color "EF4444" --description "Backend services"
gh label create "shared" --color "6366F1" --description "Shared components"
gh label create "links" --color "EC4899" --description "Link detection and discovery"

# Schema and validation
gh label create "schema" --color "14B8A6" --description "Schema definition and validation"
gh label create "extension" --color "8B5CF6" --description "Schema extensions"
gh label create "versioning" --color "06B6D4" --description "Version control and tracking"

# Moderation
gh label create "moderation" --color "F97316" --description "Moderation workflow"
gh label create "ui" --color "EC4899" --description "User interface"
gh label create "diff" --color "84CC16" --description "Diff generation and comparison"

# Time and archival
gh label create "archive" --color "78716C" --description "Archival system"
gh label create "time" --color "A855F7" --description "Temporal logic and deadlines"
gh label create "deadline" --color "DC2626" --description "Deadline detection"

# Language
gh label create "language" --color "3B82F6" --description "Multilingual support"
gh label create "accessibility" --color "22C55E" --description "Accessibility features"
gh label create "llm" --color "F472B6" --description "LLM integration"

# Quality
gh label create "quality" --color "FBBF24" --description "Quality scoring"
gh label create "ai" --color "A78BFA" --description "AI and searchability"
gh label create "ranking" --color "FB923C" --description "Ranking and scoring"

# Priority
gh label create "must-have" --color "DC2626" --description "Critical priority"
gh label create "should-have" --color "F59E0B" --description "High priority"
gh label create "critical" --color "B91C1C" --description "Critical issue"

# Automation
gh label create "automation" --color "059669" --description "Automation scripts"
gh label create "benefits" --color "7C3AED" --description "Benefits domain"

Write-Host "All labels created!" -ForegroundColor Green
