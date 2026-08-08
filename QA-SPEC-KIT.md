# QA Spec Kit -- Setup & Usage Guide

> **Evoveo Tech | Loop Engineering**
>
> *Stop prompting. Design the loop.*

The **QA Spec Kit** turns this repository into an AI-powered QA workstation.
It bundles **72 agent skills** (testing, TDD, code review, debugging, performance,
security, CI/CD, and language/framework expertise) with the **Loop Engineering**
methodology so that any AI IDE can help you write better tests, debug faster,
review code more thoroughly, and ship with confidence.

This guide explains how to set it up and use it in **every major AI IDE**.

---

## Table of Contents

1. [What You Get](#what-you-get)
2. [Prerequisites](#prerequisites)
3. [One-Time Setup (5 minutes)](#one-time-setup-5-minutes)
4. [IDE-Specific Setup](#ide-specific-setup)
   - [Claude Code](#claude-code)
   - [GitHub Copilot](#github-copilot)
   - [Cursor](#cursor)
   - [Windsurf (Codeium)](#windsurf-codeium)
   - [Devin (Cognition)](#devin-cognition)
   - [Other IDEs (Gemini, Aider, Continue, etc.)](#other-ides)
5. [How to Use It](#how-to-use-it)
6. [Example Workflows](#example-workflows)
7. [How It Works Under the Hood](#how-it-works-under-the-hood)
8. [Troubleshooting](#troubleshooting)

---

## What You Get

| Component | What it does |
|-----------|-------------|
| **72 agent skills** | Domain expertise for every type of testing -- unit, integration, E2E, performance, security, API contract, accessibility, CI/CD, and more |
| **Loop Engineering** | A structured methodology (Goal -> Action -> Observation -> Adjustment -> Stop) that replaces one-shot prompting with self-correcting loops |
| **Skill selection** | The agent automatically analyzes your repo and picks the right skills -- you don't need to know which skills exist |
| **Maker/Checker pattern** | The agent that writes code is not the agent that verifies it -- built-in quality control |
| **Prompt templates** | Ready-to-use prompts for debugging, planning, code review, and first-run repo analysis |
| **IDE-agnostic** | Works with Claude Code, GitHub Copilot, Cursor, Windsurf, Devin, and any IDE that reads `AGENTS.md` |

---

## Prerequisites

- **Git** installed (`git --version`)
- **Node.js 18+** installed (`node --version`) -- needed for the Smart Reporter itself
- **PowerShell 7+** (Windows) or **bash** (macOS/Linux) for the setup script
- At least one AI IDE installed (Claude Code, Cursor, Windsurf, GitHub Copilot, or Devin CLI)

---

## One-Time Setup (5 minutes)

### Step 1: Clone the repo

```bash
git clone https://github.com/evoveotech/testreport-forge.git
cd testreport-forge
```

### Step 2: Install dependencies

```bash
npm install
```

### Step 3: Link skills to your IDE(s)

**Windows (PowerShell):**
```powershell
pwsh scripts/setup-agents.ps1 -Project
```

**macOS / Linux:**
```bash
bash scripts/setup-agents.sh --project
```

This creates directory junctions (Windows) or symlinks (macOS/Linux) from
`.github/agents/` into each IDE's expected skills folder. All 72 skills
become available in every installed IDE simultaneously.

**What the script does:**
- Scans `.github/agents/` for skill folders
- Creates links in `.claude/skills/`, `.cursor/skills/`, `.codeium/windsurf/skills/`, `.devin/skills/`
- Junctions stay in sync -- if you update a skill, all IDEs see the update instantly
- No admin/sudo required (uses junctions on Windows, symlinks on macOS/Linux)

### Step 4: Verify

```powershell
# Windows
pwsh scripts/setup-agents.ps1 -Project -Clean
pwsh scripts/setup-agents.ps1 -Project
```

You should see `Done: created=288, skipped=0, errors=0` (72 skills x 4 IDEs).

### Step 5: Open your IDE

Open the repo folder in your AI IDE. The agent will automatically read `AGENTS.md`
and follow the First-Time User Protocol (see [How to Use It](#how-to-use-it)).

---

## IDE-Specific Setup

### Claude Code

Claude Code reads skills from `.claude/skills/<name>/SKILL.md` and `AGENTS.md`
from the repo root.

**Setup:**
```powershell
pwsh scripts/setup-agents.ps1 -Project
```

**What happens:**
- `.claude/skills/` gets 72 junctions to `.github/agents/`
- Claude Code reads `AGENTS.md` on startup -- this enforces Loop Engineering
- When you ask a question, Claude Code scans skill descriptions and invokes
  matching skills automatically

**Using it:**
1. Open the repo in Claude Code
2. Ask any question, e.g. "Help me write tests for the reporter module"
3. Claude Code will:
   - Read `AGENTS.md` (enforces Loop Engineering + First-Time Protocol)
   - Analyze the repo (detects TypeScript, Vitest, Playwright, GitHub Actions)
   - Select relevant skills (`typescript`, `testing`, `test-driven-development`, etc.)
   - Present the skill plan
   - Run the loop: Goal -> Action -> Observe -> Adjust -> Stop

**Manual setup (if script fails):**
```bash
mkdir -p .claude/skills
for skill in .github/agents/*/; do
  ln -s "$(pwd)/$skill" ".claude/skills/$(basename "$skill")"
done
```

---

### GitHub Copilot

GitHub Copilot reads `.github/copilot-instructions.md` for custom instructions
and `.github/prompts/*.md` for reusable prompt templates.

**Setup:**
No script needed -- Copilot reads directly from `.github/`. Just make sure
the repo is open in VS Code with the GitHub Copilot Chat extension installed.

**What happens:**
- Copilot reads `.github/copilot-instructions.md` -- enforces Loop Engineering
- 4 prompt templates are available in `.github/prompts/`:
  - `first-run-analyze-repo.md` -- analyze repo and select skills
  - `plan-and-implement.md` -- plan and implement a feature with the loop
  - `debug-issue.md` -- debug an issue with the loop
  - `review-before-merge.md` -- review code before merging

**Using it:**
1. Open the repo in VS Code
2. Open Copilot Chat (`Ctrl+Shift+I` or `Cmd+Shift+I`)
3. Type `@workspace` and ask your question, or use a prompt template:
   - Type `/` in Copilot Chat to see available prompts
   - Or reference a prompt directly: "Follow .github/prompts/first-run-analyze-repo.md"
4. Copilot will follow Loop Engineering and use the skills as guidance

**To link skills as well (for Copilot agents / Copilot Edits):**
```powershell
pwsh scripts/setup-agents.ps1 -Project
```
This also creates `.claude/skills/`, `.cursor/skills/`, etc. which some
Copilot features can reference.

---

### Cursor

Cursor reads rules from `.cursor/rules/*.mdc` (newer) or `.cursorrules` (legacy).
For skills, the setup script links them into `.cursor/skills/`.

**Setup:**
```powershell
pwsh scripts/setup-agents.ps1 -Project
```

**What happens:**
- `.cursor/skills/` gets 72 junctions to `.github/agents/`
- Cursor reads `AGENTS.md` for project-level instructions

**Recommended: create a Cursor rule for Loop Engineering:**

Create `.cursor/rules/loop-engineering.mdc`:
```markdown
---
description: Loop Engineering methodology + QA Spec Kit skills
globs: *
alwaysApply: true
---

Read AGENTS.md first -- it defines the Loop Engineering methodology
(Goal -> Action -> Observation -> Adjustment -> Stop) and the First-Time
User Protocol. Skills are in .github/agents/ -- scan their descriptions
to find relevant ones before acting.
```

**Using it:**
1. Open the repo in Cursor
2. Open Cursor Chat (`Ctrl+L` or `Cmd+L`)
3. Ask your question -- Cursor will read `AGENTS.md` and follow Loop Engineering
4. For Composer (`Ctrl+I`), the skills provide domain guidance for code generation

---

### Windsurf (Codeium)

Windsurf reads skills from `.codeium/windsurf/skills/<name>/SKILL.md`.

**Setup:**
```powershell
pwsh scripts/setup-agents.ps1 -Project
```

**What happens:**
- `.codeium/windsurf/skills/` gets 72 junctions to `.github/agents/`
- Windsurf reads `AGENTS.md` for project-level instructions
- Cascade (Windsurf's agent) uses skills as domain guidance

**Using it:**
1. Open the repo in Windsurf
2. Open Cascade (Windsurf's AI assistant)
3. Ask your question -- Cascade will read `AGENTS.md`, follow Loop Engineering,
   and use the skills as guidance

**Manual setup (if script fails):**
```bash
mkdir -p .codeium/windsurf/skills
for skill in .github/agents/*/; do
  ln -s "$(pwd)/$skill" ".codeium/windsurf/skills/$(basename "$skill")"
done
```

---

### Devin (Cognition)

Devin reads skills from `.devin/skills/<name>/SKILL.md`.

**Setup:**
```powershell
pwsh scripts/setup-agents.ps1 -Project
```

**What happens:**
- `.devin/skills/` gets 72 junctions to `.github/agents/`
- Devin reads `AGENTS.md` for project-level instructions

**Using it:**
1. Start Devin CLI in the repo: `devin`
2. Ask your question -- Devin will read `AGENTS.md`, follow Loop Engineering,
   and use the skills as guidance
3. For the first run, Devin will analyze the repo and present a skill plan
   before doing any work

**Manual setup (if script fails):**
```bash
mkdir -p .devin/skills
for skill in .github/agents/*/; do
  ln -s "$(pwd)/$skill" ".devin/skills/$(basename "$skill")"
done
```

---

### Other IDEs

Any IDE that supports the `AGENTS.md` standard (Gemini CLI, Aider, Continue,
Cline, etc.) will read the root `AGENTS.md` automatically.

**For IDEs that need skills in a specific folder**, use the copy mode:
```powershell
# Windows -- copies files instead of linking
pwsh scripts/setup-agents.ps1 -Copy
```

```bash
# macOS / Linux
bash scripts/setup-agents.sh --copy
```

This creates a snapshot copy of all skills. Re-run after updating skills
to refresh the copies.

**For IDEs with no skill support**, you can still use the QA Spec Kit by
manually referencing skills in your prompts:
```
Read .github/agents/testing/SKILL.md and follow its guidance
to help me write tests for this module.
```

---

## How to Use It

### The First-Time User Protocol (automatic)

When you first open the repo in any AI IDE and ask a question, the agent
automatically runs this protocol:

```
1. ANALYZE your repo
   └─ Scans for languages, frameworks, test setup, CI, architecture, security
   └─ Uses: skill-selection/SKILL.md

2. SELECT the right skills
   └─ Maps your repo to the 72 available skills
   └─ Picks: typescript (if TS), testing (always), ci-cd (if GitHub Actions), etc.

3. PRESENT the skill plan to you
   └─ "I found TypeScript + Vitest + Playwright + GitHub Actions"
   └─ "I'll use: typescript, testing, test-driven-development, ci-cd-and-automation..."
   └─ "What would you like to work on?"

4. RUN Loop Engineering for your task
   └─ Goal -> Action (using selected skills) -> Observe -> Adjust -> Stop
```

**You don't need to know which skills exist.** The agent figures it out
from your repo and tells you. You just state your problem.

### Asking Questions

Just ask naturally. The agent will use Loop Engineering and the relevant skills.

**Good questions:**
- "Help me write tests for the AI failure analysis module"
- "Why is my test flaky? Debug it using the loop"
- "Review my code before I merge -- use the code review skill"
- "Set up quality gates for my CI pipeline"
- "My Playwright tests are slow, help me optimize them"
- "Write a test strategy for this reporter"

**The agent will respond with:**
1. The recursive goal and stopping criteria
2. The action it's taking (which skill it's using)
3. The observation (test output, lint result, etc.)
4. Adjustments if needed
5. Confirmation when stopping criteria are met

### Using Prompt Templates

For structured workflows, use the prompt templates in `.github/prompts/`:

| Template | When to use |
|----------|------------|
| `first-run-analyze-repo.md` | First time opening the repo -- analyzes and selects skills |
| `plan-and-implement.md` | Planning and implementing a new feature |
| `debug-issue.md` | Debugging a bug or test failure |
| `review-before-merge.md` | Reviewing code before merging a PR |

**In Copilot:** type `/` in Copilot Chat to see available prompts.
**In other IDEs:** reference the prompt file directly in your message.

---

## Example Workflows

### Example 1: Write tests for a new module

**You say:** "Write tests for the flakiness detection module"

**Agent does:**
1. **Goal:** All tests for flakiness detection pass and coverage > 80%
2. **Action:** Reads `testing/SKILL.md` and `test-driven-development/SKILL.md`.
   Reads `typescript/SKILL.md` for TS conventions. Writes failing tests first.
3. **Observe:** Runs `npx vitest` -- sees failures
4. **Adjust:** Fixes test expectations, re-runs
5. **Stop:** All tests pass, coverage verified -- terminates

### Example 2: Debug a flaky test

**You say:** "The stability scoring test is flaky, debug it"

**Agent does:**
1. **Goal:** Stability scoring test passes consistently (3 consecutive runs)
2. **Action:** Reads `debugging-and-error-recovery/SKILL.md`. Reproduces the
   flakiness by running the test 5 times. Identifies a race condition in
   the history file read.
3. **Observe:** Writes a regression test, fixes the race, runs 5 times
4. **Adjust:** First fix doesn't fully resolve -- adds file locking
5. **Stop:** 5 consecutive passes -- terminates

### Example 3: Review code before merge

**You say:** "Review my PR before merge"

**Agent does:**
1. **Goal:** Zero critical findings, zero high-severity findings
2. **Action:** Reads `code-review-and-quality/SKILL.md`. Reviews all changed
   files across correctness, security, performance, maintainability, test coverage.
3. **Observe:** Finds 2 medium findings (missing error handling, no test for edge case)
4. **Adjust:** You fix the findings, agent re-reviews
5. **Stop:** Zero criticals, zero highs -- merge approved

### Example 4: Set up CI quality gates

**You say:** "Set up quality gates in my GitHub Actions pipeline"

**Agent does:**
1. **Goal:** CI pipeline blocks merges when pass rate < 95% or flaky rate > 5%
2. **Action:** Reads `ci-cd-and-automation/SKILL.md` and `build-pipeline-patterns/SKILL.md`.
   Adds a quality gate step to `.github/workflows/test-merge.yml`.
3. **Observe:** Runs the workflow locally with `act` or pushes a test branch
4. **Adjust:** Adjusts gate thresholds based on current test suite performance
5. **Stop:** Pipeline correctly blocks on gate failure -- terminates

### Example 5: Plan a test strategy

**You say:** "Create a test strategy for this reporter"

**Agent does:**
1. **Goal:** Complete test strategy document covering all modules
2. **Action:** Reads `qa-test-matrix/SKILL.md` and `planning-and-task-breakdown/SKILL.md`.
   Analyzes all modules, identifies test layers (unit, integration, E2E),
   creates a coverage matrix.
3. **Observe:** Reviews the matrix against actual code coverage
4. **Adjust:** Adds missing test areas (AI analysis, PDF export, CLI commands)
5. **Stop:** Strategy document complete, all modules covered -- terminates

---

## How It Works Under the Hood

### The file structure

```
testreport-forge/
├── AGENTS.md                          <- IDE entry point (enforces Loop Engineering)
├── QA-SPEC-KIT.md                     <- this guide
├── README.md                          <- Smart Reporter docs
├── .github/
│   ├── copilot-instructions.md        <- Copilot entry point
│   ├── agents/                        <- 72 skills (canonical source)
│   │   ├── README.md                  <- skill setup guide
│   │   ├── loop-engineering/SKILL.md  <- the framework
│   │   ├── skill-selection/SKILL.md   <- repo analysis + skill matching
│   │   ├── testing/SKILL.md           <- testing conventions
│   │   ├── test-driven-development/   <- TDD workflow
│   │   ├── code-review-and-quality/   <- review before merge
│   │   ├── debugging-and-error-recovery/
│   │   ├── ci-cd-and-automation/
│   │   ├── typescript/                <- TS conventions
│   │   ├── ... (60+ more skills)
│   │   └── agents-manifest.json       <- machine-readable skill index
│   ├── prompts/                       <- ready-to-use prompt templates
│   │   ├── first-run-analyze-repo.md
│   │   ├── plan-and-implement.md
│   │   ├── debug-issue.md
│   │   └── review-before-merge.md
│   └── workflows/                     <- CI pipelines
├── scripts/
│   ├── setup-agents.ps1               <- Windows: link skills to IDEs
│   ├── setup-agents.sh                <- macOS/Linux: link skills to IDEs
│   └── restructure-skills.ps1         <- re-apply branding to all skills
├── .claude/skills/                    <- 72 junctions (Claude Code)
├── .cursor/skills/                    <- 72 junctions (Cursor)
├── .codeium/windsurf/skills/          <- 72 junctions (Windsurf)
└── .devin/skills/                     <- 72 junctions (Devin)
```

### How the agent finds and uses skills

```
1. IDE opens repo -> reads AGENTS.md
2. AGENTS.md says: "Follow Loop Engineering + run First-Time Protocol"
3. Agent reads skill-selection/SKILL.md -> analyzes repo
4. Agent selects relevant skills from .github/agents/
5. User states task
6. Agent runs the loop:
   Goal -> Action (reads relevant SKILL.md for guidance) -> Observe -> Adjust -> Stop
7. Maker/Checker: separate verification pass
8. Spine: progress recorded
```

### Why this gives better answers

| Without QA Spec Kit | With QA Spec Kit |
|---------------------|-------------------|
| Generic AI responses | Skill-guided responses with testing domain expertise |
| One-shot answers | Iterative loops that verify results |
| Agent guesses your stack | Agent analyzes your repo and selects matching skills |
| No quality control | Maker/checker pattern enforces verification |
| Forgets context between runs | Spine (AGENTS.md, progress files) persists knowledge |
| No stopping criteria | Every task has verifiable stopping criteria |
| Ad hoc debugging | Systematic root-cause debugging with `debugging-and-error-recovery` |
| Manual code review | Multi-axis review with `code-review-and-quality` |

---

## Troubleshooting

### Skills not showing up in my IDE

**Check junctions were created:**
```powershell
# Windows
Get-ChildItem .claude\skills -Directory | Measure-Object
Get-ChildItem .cursor\skills -Directory | Measure-Object
Get-ChildItem .codeium\windsurf\skills -Directory | Measure-Object
Get-ChildItem .devin\skills -Directory | Measure-Object
```

Each should show 72 directories. If not, re-run:
```powershell
pwsh scripts/setup-agents.ps1 -Project -Clean
pwsh scripts/setup-agents.ps1 -Project
```

**On macOS/Linux, if symlinks fail:**
```bash
# Check if symlinks exist
ls -la .claude/skills/ | head -5

# Recreate
bash scripts/setup-agents.sh --project --clean
bash scripts/setup-agents.sh --project
```

### Agent isn't following Loop Engineering

**Make sure your IDE reads AGENTS.md:**
- Claude Code: reads it automatically
- Cursor: create a `.cursor/rules/loop-engineering.mdc` rule (see [Cursor setup](#cursor))
- Windsurf: reads it automatically if it supports the AGENTS.md standard
- Copilot: reads `.github/copilot-instructions.md` which enforces it
- Devin: reads it automatically

**Force the agent to follow it:**
Start your message with: "Read AGENTS.md and follow the Loop Engineering methodology"

### Agent isn't using skills

**Explicitly tell the agent:**
"Read .github/agents/skill-selection/SKILL.md and analyze my repo to select
the right skills before answering."

**Or use the first-run prompt:**
"Follow .github/prompts/first-run-analyze-repo.md"

### Setup script fails on Windows

**Run as regular user (not admin):**
The script uses directory junctions which don't require admin privileges.
If it still fails, check for antivirus or corporate policy blocking junctions.

**Fallback -- use copy mode:**
```powershell
pwsh scripts/setup-agents.ps1 -Project -Copy
```
This copies files instead of linking. Re-run after updating skills.

### Setup script fails on macOS/Linux

**Check symlink permissions:**
```bash
# Some systems restrict symlinks without developer tools
xcode-select --install  # macOS
```

**Fallback -- use copy mode:**
```bash
bash scripts/setup-agents.sh --project --copy
```

### Want to add a new skill

1. Create `.github/agents/<my-skill>/SKILL.md` with Evoveo Tech frontmatter
2. Run `pwsh scripts/restructure-skills.ps1` to apply branding
3. Re-run `pwsh scripts/setup-agents.ps1 -Project` to link it
4. Add it to `AGENTS.md` in the appropriate category

### Want to remove skills

Just delete the folder from `.github/agents/` and re-run the setup script:
```powershell
pwsh scripts/setup-agents.ps1 -Project -Clean
pwsh scripts/setup-agents.ps1 -Project
```

---

## Quick Reference

| Command | What it does |
|---------|-------------|
| `pwsh scripts/setup-agents.ps1 -Project` | Link skills to all IDEs (Windows) |
| `bash scripts/setup-agents.sh --project` | Link skills to all IDEs (macOS/Linux) |
| `pwsh scripts/setup-agents.ps1 -Project -Clean` | Remove all IDE links |
| `pwsh scripts/setup-agents.ps1 -Project -Copy` | Copy skills instead of linking |
| `pwsh scripts/restructure-skills.ps1` | Re-apply Evoveo Tech branding to all skills |
| `pwsh scripts/restructure-skills.ps1 -Force` | Force re-apply branding (overwrite) |
| `npm run build` | Build the Smart Reporter |
| `npm test` | Run the test suite |
| `npm run test:demo` | Run demo tests |

| File | What it is |
|------|-----------|
| `AGENTS.md` | IDE entry point -- enforces Loop Engineering |
| `QA-SPEC-KIT.md` | This guide |
| `.github/copilot-instructions.md` | Copilot entry point |
| `.github/agents/` | 72 skills (canonical source) |
| `.github/agents/loop-engineering/SKILL.md` | The framework documentation |
| `.github/agents/skill-selection/SKILL.md` | Repo analysis + skill selection |
| `.github/prompts/` | Ready-to-use prompt templates |
| `scripts/setup-agents.ps1` | Windows setup script |
| `scripts/setup-agents.sh` | macOS/Linux setup script |

---

*Evoveo Tech QA Spec Kit -- powered by Loop Engineering*
*Goal -> Action -> Observation -> Adjustment -> Stop*
