# Add labels to issues created in alphabetical filename order

# CRAWL issues (4-6)
gh issue edit 4 --add-label "crawler,backend,shared,must-have"
gh issue edit 5 --add-label "crawler,benefits,must-have"
gh issue edit 6 --add-label "crawler,links,automation"

# DATA issues (7-9)
gh issue edit 7 --add-label "data,schema,architecture,must-have"
gh issue edit 8 --add-label "data,schema,extension,architecture"
gh issue edit 9 --add-label "schema,versioning,data,architecture"

# EPIC issues (10-15)
gh issue edit 10 --add-label "epic,architecture,data"
gh issue edit 11 --add-label "epic,crawler,backend"
gh issue edit 12 --add-label "epic,moderation,ui"
gh issue edit 13 --add-label "epic,data,archive"
gh issue edit 14 --add-label "epic,language,accessibility"
gh issue edit 15 --add-label "epic,quality,ai"

# LANG issues (16-18)
gh issue edit 16 --add-label "language,schema,data"
gh issue edit 17 --add-label "language,crawler,data"
gh issue edit 18 --add-label "language,llm,accessibility"

# MOD issues (19-21)
gh issue edit 19 --add-label "moderation,schema,must-have"
gh issue edit 20 --add-label "moderation,diff,automation"
gh issue edit 21 --add-label "moderation,ui,should-have"

# QUALITY issues (22-24)
gh issue edit 22 --add-label "quality,ai,ranking,data"
gh issue edit 23 --add-label "quality,automation,data"
gh issue edit 24 --add-label "moderation,ui,quality"

# TIME issues (25-27)
gh issue edit 25 --add-label "data,schema,time,critical"
gh issue edit 26 --add-label "archive,versioning,data"
gh issue edit 27 --add-label "deadline,automation,data"

Write-Host "All labels added!" -ForegroundColor Green
