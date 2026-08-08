# Evoveo Tech Agent Skills -- Universal IDE Setup

> **Stop prompting. Design the loop.**

This repo uses **Loop Engineering** as its operating methodology. Every task is
an iterative loop: Goal -> Action -> Observation -> Adjustment -> Stop. The
**71 skills** in this folder are domain knowledge applied *within* that loop.

## First-Time User Flow

When a user first opens this repo with any AI IDE, the agent automatically:

```
1. ANALYZE the repo
   └─ Scan for languages, frameworks, tests, CI, architecture, security
   └─ Uses: skill-selection/SKILL.md (the decision framework)

2. SELECT appropriate skills
   └─ Map repo characteristics to the 71 available skills
   └─ Always include: loop-engineering, testing, TDD, code-review, debugging, git
   └─ Plus matched skills based on what was detected

3. PRESENT the skill plan
   └─ "I found TypeScript + React + Vitest + GitHub Actions"
   └─ "I'll use: typescript, react, testing, ci-cd-and-automation, ..."
   └─ "What would you like to work on?"

4. RUN Loop Engineering for the user's task
   └─ Goal -> Action (using selected skills) -> Observe -> Adjust -> Stop
   └─ Maker/Checker: separate agent verifies
   └─ Spine: progress recorded
```

**The user doesn't need to know which skills exist.** The agent figures it out
from the repo and tells them. The user just states their problem; the agent
selects the right skills and runs the loop.

## The Relationship: Loop Engineering vs Skills

```
┌─────────────────────────────────────────────────────┐
│              LOOP ENGINEERING (the framework)        │
│                                                     │
│   Goal -> Action -> Observe -> Adjust -> Stop       │
│                                                     │
│   ┌─────────────────────────────────────────────┐   │
│   │         SKILLS (the domain knowledge)        │   │
│   │                                             │   │
│   │   testing, tdd, code-review, debugging,     │   │
│   │   performance, security, ci-cd, python,     │   │
│   │   typescript, csharp, react, ...            │   │
│   │                                             │   │
│   │   These tell the agent HOW to do something  │   │
│   │   well. Loop Engineering tells it HOW TO    │   │
│   │   WORK.                                     │   │
│   └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

**Loop Engineering** is the mandatory methodology for every interaction.
**Skills** are the expertise that gets loaded into the loop's Action step.

Full framework documentation: [`loop-engineering/SKILL.md`](loop-engineering/SKILL.md)
Repo entry point: [`../../AGENTS.md`](../../AGENTS.md)

---

## The Loop (applies to every task)

```
1. GOAL      -- Define a recursive goal with verifiable stopping criteria
2. ACTION    -- Act toward the goal, using relevant skills as guidance
3. OBSERVE   -- Evaluate the result (run tests, lint, typecheck, build)
4. ADJUST    -- Change approach based on what the observation tells you
5. STOP      -- Terminate when stopping criteria are met
```

Key principles:
- **Recursive goals** -- explicit targets with verifiable stopping criteria
- **Maker/Checker** -- the agent that writes is NOT the agent that verifies
- **Spine (memory)** -- progress tracked in persistent state (AGENTS.md, progress files)
- **Human-in-the-loop** -- human checkpoints to avoid comprehension debt and cognitive surrender

---

## Skill Format

Each skill is a folder with `SKILL.md` containing Evoveo Tech frontmatter with
Loop Engineering metadata, plus three body sections:

```yaml
---
name: skill-name
description: When to use this skill...
brand: evoveo-tech
agent: Evoveo Tech Agent
loop_type: recursive-goal
goal_template: "Stop iterating when <verifiable condition>"
stopping_criteria: "<test command or check>"
verification: "<how a checker agent verifies>"
maker_checker: true
---
```

Body sections:
1. **Loop Engineering Execution** -- how this skill maps to Goal/Action/Observation/Adjustment
2. **Skill Guidance** -- the domain-specific instructions (the actual expertise)
3. **Verification Checklist** -- what a checker agent validates before the loop terminates

## Folder Structure

```
.github/agents/
├── README.md                          <- you are here
├── loop-engineering/                  <- THE FRAMEWORK (how to work)
│   └── SKILL.md                       <- full Loop Engineering documentation
├── skill-selection/                   <- RUN FIRST (analyzes repo, selects skills)
│   └── SKILL.md                       <- repo analysis + skill matching decision framework
├── <skill-name>/                      <- domain knowledge (69 domain skills)
│   ├── SKILL.md                       <- Evoveo Tech skill (frontmatter + Loop Eng + guidance)
│   └── references/                    <- optional detailed reference docs
└── ...
```

---

## One-Command Setup (all IDEs at once)

The setup scripts link `.github/agents/` into every IDE's expected skills folder:

```powershell
# Windows (PowerShell) -- creates directory junctions (no admin needed)
pwsh scripts/setup-agents.ps1
```

```bash
# macOS / Linux -- creates symlinks
bash scripts/setup-agents.sh
```

Options:
- `--project` / `-Project` -- only project-local IDE folders (not user-global)
- `--clean` / `-Clean` -- remove all created links
- `--copy` / `-Copy` -- use file copies instead of links (snapshot, not live sync)

---

## IDE-Specific Setup

### Claude Code

Claude Code reads skills from `.claude/skills/<name>/SKILL.md` and `AGENTS.md`
from the repo root.

**Automatic (recommended):**
```powershell
pwsh scripts/setup-agents.ps1 -Project
```

**Manual:**
```bash
mkdir -p .claude/skills
for skill in .github/agents/*/; do
  ln -s "$(pwd)/$skill" ".claude/skills/$(basename "$skill")"
done
```

### GitHub Copilot

GitHub Copilot reads `.github/copilot-instructions.md` for custom instructions
and `.github/prompts/*.md` for reusable prompt templates.

This repo includes:
- `.github/copilot-instructions.md` -- enforces Loop Engineering as the first step
- `.github/prompts/` -- ready-to-use prompt templates (all start with Loop Engineering)

No symlinks needed -- Copilot reads directly from `.github/`.

### Cursor

Cursor reads rules from `.cursor/rules/*.mdc` (newer) or `.cursorrules` (legacy).

**Automatic:**
```powershell
pwsh scripts/setup-agents.ps1 -Project
```

**Manual (rules approach):**
Create `.cursor/rules/agents-index.mdc`:
```markdown
---
description: Loop Engineering + agent skills index
globs: *
---
Read AGENTS.md first -- it defines the Loop Engineering methodology.
Then scan .github/agents/ for skills matching the task.
```

### Windsurf (Codeium)

Windsurf reads skills from `.codeium/windsurf/skills/<name>/SKILL.md`.

**Automatic:**
```powershell
pwsh scripts/setup-agents.ps1 -Project
```

**Manual:**
```bash
mkdir -p .codeium/windsurf/skills
for skill in .github/agents/*/; do
  ln -s "$(pwd)/$skill" ".codeium/windsurf/skills/$(basename "$skill")"
done
```

### Devin (Cognition)

Devin reads skills from `.devin/skills/<name>/SKILL.md`.

**Automatic:**
```powershell
pwsh scripts/setup-agents.ps1 -Project
```

**Manual:**
```bash
mkdir -p .devin/skills
for skill in .github/agents/*/; do
  ln -s "$(pwd)/$skill" ".devin/skills/$(basename "$skill")"
done
```

### Other IDEs (AGENTS.md standard)

Any IDE that supports the `AGENTS.md` standard (Gemini, Aider, Continue, etc.)
will read the root `AGENTS.md` automatically. That file enforces Loop Engineering
as the mandatory methodology and indexes all 70 skills.

---

## User-Global vs Project-Local

By default, the setup scripts link skills into **both** project-local and
user-global locations:

| Scope | Location | Shared across repos? |
|-------|----------|---------------------|
| Project | `.claude/skills/`, `.cursor/skills/`, etc. | No (this repo only) |
| User | `~/.claude/skills/`, `~/.cursor/skills/`, etc. | Yes (all repos) |

Use `--project` / `-Project` to only set up project-local links.

---

## Updating Skills

Skills in `.github/agents/` are the source of truth. When you update a skill:

1. Edit `.github/agents/<skill-name>/SKILL.md`
2. If using junctions/symlinks -- **nothing else needed** (links are live)
3. If using copies -- re-run `pwsh scripts/setup-agents.ps1 -Copy`

To re-apply Evoveo Tech branding + Loop Engineering structure to all skills:
```powershell
pwsh scripts/restructure-skills.ps1 -Force
```

## Adding a New Skill

1. Create `.github/agents/<my-skill>/SKILL.md` with Evoveo Tech frontmatter:
   ```markdown
   ---
   name: my-skill
   description: When to use this skill...
   brand: evoveo-tech
   agent: Evoveo Tech Agent
   loop_type: recursive-goal
   goal_template: "Stop iterating when <verifiable condition>"
   stopping_criteria: "<test command or check>"
   verification: "A separate checker Evoveo Tech Agent verifies..."
   maker_checker: true
   ---

   <!-- Evoveo Tech -- Agent Skill -->

   # My Skill

   > **Evoveo Tech Agent** -- Powered by Loop Engineering

   ## Loop Engineering Execution
   ...

   ## Skill Guidance
   ...

   ## Verification Checklist
   ...
   ```
2. Add optional `references/` subfolder for detailed docs
3. Re-run the setup script to link it into IDE folders
4. Add an entry to `AGENTS.md` in the appropriate category
