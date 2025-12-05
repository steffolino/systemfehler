#!/usr/bin/env pwsh

$issuesDir = Join-Path $PSScriptRoot "..\issues"
$issueFiles = Get-ChildItem -Path $issuesDir -Filter "*.md" | Sort-Object Name

foreach ($file in $issueFiles) {
    Write-Host "Processing: $($file.Name)" -ForegroundColor Cyan
    
    $content = Get-Content $file.FullName -Raw
    $lines = Get-Content $file.FullName
    
    # Extract title (first line)
    $title = $lines[0].Trim()
    
    # Extract labels (after "Labels:" line)
    $labelsLine = $lines | Where-Object { $_ -match "^Labels:" } | Select-Object -First 1
    $labels = @()
    if ($labelsLine -match "^Labels:\s*(.+)") {
        $labels = $matches[1].Split(',').Trim() | Where-Object { $_ }
    }
    
    # Extract assignees (after "Assignees:" line)
    $assigneesLine = $lines | Where-Object { $_ -match "^Assignees:" } | Select-Object -First 1
    $assignees = @()
    if ($assigneesLine -match "^Assignees:\s*(.+)") {
        $assignees = $matches[1].Split(',').Trim() | Where-Object { $_ }
    }
    
    # Extract milestone (after "Milestone:" line)
    $milestoneLine = $lines | Where-Object { $_ -match "^Milestone:" } | Select-Object -First 1
    $milestone = $null
    if ($milestoneLine -match "^Milestone:\s*(.+)") {
        $milestone = $matches[1].Trim()
    }
    
    # Find description start (after "Description:")
    $descStart = 0
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match "^Description:") {
            $descStart = $i + 1
            break
        }
    }
    
    # Build body from Description onwards
    $body = ($lines[$descStart..($lines.Count - 1)] -join "`n").Trim()
    
    # Build gh command
    $ghArgs = @('issue', 'create', '--title', $title, '--body', $body)
    
    if ($labels.Count -gt 0) {
        $ghArgs += '--label'
        $ghArgs += ($labels -join ',')
    }
    
    if ($assignees.Count -gt 0) {
        foreach ($assignee in $assignees) {
            $ghArgs += '--assignee'
            $ghArgs += $assignee
        }
    }
    
    if ($milestone) {
        $ghArgs += '--milestone'
        $ghArgs += $milestone
    }
    
    Write-Host "Creating issue: $title" -ForegroundColor Green
    Write-Host "Labels: $($labels -join ', ')" -ForegroundColor Yellow
    
    # Execute gh command
    & gh @ghArgs
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Created successfully`n" -ForegroundColor Green
    } else {
        Write-Host "✗ Failed to create`n" -ForegroundColor Red
    }
    
    Start-Sleep -Milliseconds 500
}

Write-Host "`nAll issues processed!" -ForegroundColor Cyan
