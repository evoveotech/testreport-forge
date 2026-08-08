<#
.SYNOPSIS
  Restructures all SKILL.md files in .github/agents/ to follow the Evoveo Tech
  branding and Loop Engineering agentic framework.

.DESCRIPTION
  For each skill:
  1. Parses existing YAML frontmatter (preserves name + description)
  2. Adds Evoveo Tech branding fields (brand, agent, loop_type, goal_template,
     stopping_criteria, verification, maker_checker)
  3. Replaces generic AI references with "Evoveo Tech Agent"
  4. Wraps existing content in a Loop Engineering structure:
     - Branded header comment
     - "Loop Engineering Execution" section (Goal -> Action -> Observation -> Adjustment)
     - "Skill Guidance" section (original content preserved)
     - "Verification Checklist" section
     - Branded footer
  5. Writes the restructured file back

  Safe to run multiple times — detects already-restructured files and skips them.

.PARAMETER DryRun
  Show what would be changed without writing files.

.PARAMETER Force
  Re-restructure files even if they already have Evoveo Tech branding.
#>

[CmdletBinding()]
param(
  [switch]$DryRun,
  [switch]$Force
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$agentsDir = Join-Path $repoRoot ".github\agents"

if (-not (Test-Path $agentsDir)) {
  Write-Error "Agents directory not found: $agentsDir"
  exit 1
}

$skills = Get-ChildItem -Path $agentsDir -Directory | Sort-Object Name
Write-Host "Found $($skills.Count) skills in $agentsDir" -ForegroundColor Cyan

$restructured = 0
$skipped = 0
$errors = 0
$tb = '```'  # triple backtick constant (single-quoted to avoid escape interpretation)

foreach ($skill in $skills) {
  $skillMd = Join-Path $skill.FullName "SKILL.md"
  $skillName = $skill.Name

  if (-not (Test-Path $skillMd)) {
    Write-Host "  SKIP (no SKILL.md): $skillName" -ForegroundColor DarkGray
    $skipped++
    continue
  }

  $content = Get-Content $skillMd -Raw -Encoding UTF8

  # Skip if already restructured (unless --force)
  if (-not $Force -and $content -match 'brand:\s*evoveo-tech') {
    $skipped++
    continue
  }

  try {
    # --- Parse frontmatter ---
    $frontmatter = @{}
    $body = $content
    if ($content -match '(?s)^---\s*\r?\n(.*?)\r?\n---\s*\r?\n(.*)') {
      $fmText = $matches[1]
      $body = $matches[2]
      foreach ($line in ($fmText -split "`n")) {
        if ($line -match '^\s*([a-z_]+):\s*(.*)$') {
          $key = $matches[1]
          $val = $matches[2].Trim().Trim('"').Trim("'")
          $frontmatter[$key] = $val
        }
      }
    }

    $name = if ($frontmatter.ContainsKey("name")) { $frontmatter["name"] } else { $skillName }
    $description = if ($frontmatter.ContainsKey("description")) { $frontmatter["description"] } else { "" }

    # --- Replace generic AI references in the body ---
    $body = $body -replace '(?i)\bAI assistant\b', 'Evoveo Tech Agent'
    $body = $body -replace '(?i)\bAI coding assistant\b', 'Evoveo Tech Agent'
    $body = $body -replace '(?i)\bAI agent\b', 'Evoveo Tech Agent'
    $body = $body -replace '(?i)\bthe agent\b', 'the Evoveo Tech Agent'
    $body = $body -replace '(?i)\bcoding agent\b', 'Evoveo Tech Agent'
    $body = $body -replace '(?i)\bthe model\b', 'the Evoveo Tech Agent'
    $body = $body -replace '(?i)\bthe AI\b', 'the Evoveo Tech Agent'
    $body = $body -replace '(?i)\bAI-generated\b', 'Evoveo Tech Agent-generated'

    # --- Derive loop engineering fields ---
    $goalTemplate = "Stop iterating when the task meets all acceptance criteria for: $name"
    $stoppingCriteria = "All tests pass, lint is clean, and the skill's acceptance criteria are met"
    $verification = "A separate checker Evoveo Tech Agent verifies the output against the skill's acceptance criteria"

    if ($name -match "test|tdd|testing|qa") {
      $stoppingCriteria = "All tests pass and coverage meets the target threshold"
    } elseif ($name -match "review|brutal|code-review") {
      $stoppingCriteria = "Zero critical findings and zero high-severity findings"
    } elseif ($name -match "debug|crash|bug") {
      $stoppingCriteria = "The bug is reproduced, root cause identified, fix verified by a passing test"
    } elseif ($name -match "security|harden") {
      $stoppingCriteria = "Security scan passes with zero critical vulnerabilities"
    } elseif ($name -match "performance|optim") {
      $stoppingCriteria = "Performance benchmarks meet the target thresholds"
    } elseif ($name -match "build|ci|cd|deploy|ship|release") {
      $stoppingCriteria = "Build succeeds, CI is green, deployment artifacts are produced"
    } elseif ($name -match "git|commit|branch|version") {
      $stoppingCriteria = "Git operations complete, working tree is clean, commits follow conventions"
    } elseif ($name -match "doc|adr|documentation") {
      $stoppingCriteria = "Documentation is complete, accurate, and passes review"
    } elseif ($name -match "plan|task|breakdown|spec|idea|interview") {
      $stoppingCriteria = "Plan is complete with ordered tasks, acceptance criteria, and no open questions"
    } elseif ($name -match "migration|deprecation|legacy") {
      $stoppingCriteria = "Migration is complete, old system is removed, all tests pass"
    } elseif ($name -match "unity|unreal|godot|web-game|web-build") {
      $stoppingCriteria = "Build succeeds on target platform and meets performance budget"
    } elseif ($name -match "design|combat|level|quest|narrative|progression|economy|monetiz|liveops|core-loop|game-feel|onboarding|playtest|gdd|milestone|vertical-slice|procgen|ai-behavior") {
      $stoppingCriteria = "Design document is complete, reviewed, and actionable for implementation"
    } elseif ($name -match "asset|pipeline|art|audio|vfx|cinematic|sprite|animation|material|rigging|lighting|texture|shader|tilemap|3d-|2d-|placeholder|generated-raster|ui-asset|ui-animation") {
      $stoppingCriteria = "Assets are imported, validated, and meet the pipeline naming and format conventions"
    } elseif ($name -match "store|console|certification|compliance") {
      $stoppingCriteria = "All compliance checklist items pass and submission package is complete"
    } elseif ($name -match "frontend|react|nextjs|typescript|javascript|ui-hud|accessibility|browser-testing") {
      $stoppingCriteria = "UI renders correctly, WCAG checks pass, build succeeds"
    } elseif ($name -match "python|nestjs|csharp|dotnet|api|backend") {
      $stoppingCriteria = "Code compiles, type checks pass, all tests pass"
    } elseif ($name -match "observ|telemetry|instrument") {
      $stoppingCriteria = "Instrumentation is deployed, metrics/logs/traces are visible in the dashboard"
    } elseif ($name -match "context-engineer|orchestration|agent-skills|using-|find-skills|autoresearch|verification-loop|loop-engineering|doubt-driven|source-driven") {
      $stoppingCriteria = "Agent context is configured, skills are linked, and the loop runs end-to-end"
    }

    # --- Extract title from body ---
    $title = $name
    $bodyWithoutH1 = $body
    if ($body -match '(?s)^\s*#\s+(.+?)\r?\n(.*)') {
      $title = $matches[1].Trim()
      $bodyWithoutH1 = $matches[2]
    }
    $bodyWithoutH1 = $bodyWithoutH1.TrimStart()

    # --- Build new content using string array ---
    $lines = @()
    $lines += "---"
    $lines += "name: $name"
    $lines += "description: $description"
    $lines += "brand: evoveo-tech"
    $lines += "agent: Evoveo Tech Agent"
    $lines += "loop_type: recursive-goal"
    $lines += "goal_template: `"$goalTemplate`""
    $lines += "stopping_criteria: `"$stoppingCriteria`""
    $lines += "verification: `"$verification`""
    $lines += "maker_checker: true"
    $lines += "---"
    $lines += ""
    $lines += "<!-- Evoveo Tech -- Agent Skill -->"
    $lines += ""
    $lines += "# $title"
    $lines += ""
    $lines += "> **Evoveo Tech Agent** -- Powered by Loop Engineering"
    $lines += ""
    $lines += "## Loop Engineering Execution"
    $lines += ""
    $lines += "This skill operates within the Evoveo Tech Loop Engineering framework:"
    $lines += ""
    $lines += $tb
    $lines += "Goal     -> Apply $name to achieve the task objective"
    $lines += "Action   -> Execute the skill guidance below"
    $lines += "Observe  -> $stoppingCriteria"
    $lines += "Adjust   -> If criteria not met, adjust approach and re-execute"
    $lines += "Stop     -> Terminate when stopping criteria are satisfied"
    $lines += $tb
    $lines += ""
    $lines += "**Recursive Goal:** $goalTemplate"
    $lines += ""
    $lines += "**Stopping Criteria:** $stoppingCriteria"
    $lines += ""
    $lines += "**Maker/Checker:** The Evoveo Tech Agent that executes this skill must not be"
    $lines += "the same agent that verifies the result. A separate checker agent validates"
    $lines += "the output against the stopping criteria."
    $lines += ""
    $lines += "## Skill Guidance"
    $lines += ""
    $lines += $bodyWithoutH1
    $lines += ""
    $lines += "## Verification Checklist"
    $lines += ""
    $lines += "Before the loop terminates, a checker Evoveo Tech Agent must verify:"
    $lines += ""
    $lines += "- [ ] The skill's core guidance was followed"
    $lines += "- [ ] $stoppingCriteria"
    $lines += "- [ ] No regressions were introduced"
    $lines += "- [ ] Changes are documented if applicable"
    $lines += "- [ ] Human review checkpoint passed (for production-critical changes)"
    $lines += ""
    $lines += "---"
    $lines += ""
    $lines += "*Evoveo Tech Agent Skill -- Loop Engineering Framework*"
    $lines += "*Goal -> Action -> Observation -> Adjustment -> Stop*"

    $newContent = $lines -join "`n"

    if ($DryRun) {
      Write-Host "  DRY RUN: $skillName" -ForegroundColor Yellow
    } else {
      [System.IO.File]::WriteAllText($skillMd, $newContent, [System.Text.UTF8Encoding]::new($false))
      $restructured++
    }
  } catch {
    $errors++
    Write-Host "  ERROR: $skillName - $_" -ForegroundColor Red
  }
}

Write-Host ""
Write-Host "Done: restructured=$restructured, skipped=$skipped, errors=$errors" -ForegroundColor Green
