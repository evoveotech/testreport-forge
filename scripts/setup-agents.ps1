<#
.SYNOPSIS
  Links the canonical agent skills from .github/agents/ into every AI IDE's
  expected location so Claude, Copilot, Cursor, Windsurf, and Devin all pick
  them up automatically.

.DESCRIPTION
  Canonical source: .github/agents/<skill-name>/SKILL.md
  This script creates directory junctions (no admin required on Windows) from
  the canonical source into each IDE's expected skills folder. Junctions stay
  in sync with .github/agents/ automatically — no re-run needed after updates.

  Run from the repository root:
    pwsh scripts/setup-agents.ps1            # link all IDEs (user + project)
    pwsh scripts/setup-agents.ps1 -Project   # link only project-local IDE folders
    pwsh scripts/setup-agents.ps1 -Clean     # remove all created junctions

.PARAMETER Project
  Only create project-local links (.claude/skills, .cursor/skills,
  .codeium/windsurf/skills, .devin/skills). Skips user-global locations.

.PARAMETER Clean
  Remove all junctions created by this script, then exit.

.PARAMETER Copy
  Use file copies instead of junctions. Use this if your filesystem or
  IDE does not support junctions. Copies are a snapshot — re-run after
  updating .github/agents/ to refresh.
#>

[CmdletBinding()]
param(
  [switch]$Project,
  [switch]$Clean,
  [switch]$Copy
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$canonical = Join-Path $repoRoot ".github\agents"

if (-not (Test-Path $canonical)) {
  Write-Error "Canonical skills folder not found: $canonical"
  exit 1
}

$skills = Get-ChildItem -Path $canonical -Directory | Sort-Object Name
Write-Host "Found $($skills.Count) skills in $canonical" -ForegroundColor Cyan

# ---------------------------------------------------------------------------
# Target locations: each IDE's expected skills folder.
#   project = relative to repo root (checked into the repo)
#   user    = global per-user location (shared across all repos)
# ---------------------------------------------------------------------------
$targets = @(
  @{ Name = "Claude (project)";   Path = ".claude\skills";                Scope = "project" }
  @{ Name = "Cursor (project)";   Path = ".cursor\skills";                Scope = "project" }
  @{ Name = "Windsurf (project)"; Path = ".codeium\windsurf\skills";      Scope = "project" }
  @{ Name = "Devin (project)";    Path = ".devin\skills";                 Scope = "project" }
  @{ Name = "Claude (user)";      Path = "$env:USERPROFILE\.claude\skills";           Scope = "user" }
  @{ Name = "Cursor (user)";      Path = "$env:USERPROFILE\.cursor\skills";           Scope = "user" }
  @{ Name = "Windsurf (user)";    Path = "$env:USERPROFILE\.codeium\windsurf\skills"; Scope = "user" }
  @{ Name = "Devin (user)";       Path = "$env:USERPROFILE\.devin\skills";            Scope = "user" }
)

if ($Project) {
  $targets = $targets | Where-Object { $_.Scope -eq "project" }
}

# ---------------------------------------------------------------------------
# Clean mode: remove junctions/links we created.
# ---------------------------------------------------------------------------
if ($Clean) {
  Write-Host "Cleaning existing links..." -ForegroundColor Yellow
  foreach ($t in $targets) {
    $targetPath = if ($t.Scope -eq "project") { Join-Path $repoRoot $t.Path } else { $t.Path }
    if (-not (Test-Path $targetPath)) { continue }
    Get-ChildItem -Path $targetPath -Directory -ErrorAction SilentlyContinue | ForEach-Object {
      $isJunction = (Get-Item $_.FullName -Force).LinkType -eq "Junction"
      if ($isJunction -or $Copy) {
        Remove-Item $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "  removed $($_.Name) from $($t.Name)"
      }
    }
  }
  Write-Host "Clean complete." -ForegroundColor Green
  exit 0
}

# ---------------------------------------------------------------------------
# Link or copy each skill into each target.
# ---------------------------------------------------------------------------
$linkType = if ($Copy) { "copy" } else { "junction" }
Write-Host "Mode: $linkType" -ForegroundColor Cyan

$created = 0; $skipped = 0; $errors = 0

foreach ($t in $targets) {
  $targetPath = if ($t.Scope -eq "project") { Join-Path $repoRoot $t.Path } else { $t.Path }
  New-Item -ItemType Directory -Path $targetPath -Force | Out-Null
  Write-Host "`n[$($t.Name)] -> $targetPath" -ForegroundColor White

  foreach ($skill in $skills) {
    $linkPath = Join-Path $targetPath $skill.Name

    # Skip if a real (non-junction) folder already exists there.
    if (Test-Path $linkPath) {
      $item = Get-Item $linkPath -Force
      if ($item.LinkType) {
        Remove-Item $linkPath -Force -ErrorAction SilentlyContinue
      } else {
        $skipped++; continue
      }
    }

    try {
      if ($Copy) {
        Copy-Item -Path $skill.FullName -Destination $linkPath -Recurse -Force
      } else {
        # Directory junction — no admin required on Windows.
        cmd /c mklink /J "$linkPath" "$($skill.FullName)" | Out-Null
        if (-not (Test-Path $linkPath)) { throw "mklink failed" }
      }
      $created++
    } catch {
      $errors++
      Write-Host "  ERROR: $($skill.Name) - $_" -ForegroundColor Red
    }
  }
}

Write-Host "`nDone: created=$created, skipped=$skipped, errors=$errors" -ForegroundColor Green
if (-not $Copy) {
  Write-Host "Junctions stay in sync with .github/agents/ automatically." -ForegroundColor DarkGray
} else {
  Write-Host "Copies are a snapshot — re-run this script after updating .github/agents/." -ForegroundColor DarkGray
}
