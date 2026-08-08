# AGENTS.md -- Evoveo Tech | Loop Engineering

> **Stop prompting. Design the loop.**
>
> This repository uses **Loop Engineering** as its operating methodology.
> Every task -- whether from a human, an AI agent, or a CI pipeline -- is
> approached as an iterative loop, not a one-shot prompt.

---

## FIRST-TIME USER PROTOCOL (run this before anything else)

**When a user interacts with this repo for the first time, the agent MUST:**

### 1. Analyze the repo automatically

Before answering any question or doing any work, scan the repository to
understand what it is:

- **Languages**: check `package.json`, `pyproject.toml`, `*.csproj`, `pubspec.yaml`, etc.
- **Frameworks**: check dependencies (React, Next.js, NestJS, Flutter, Unity, etc.)
- **Test setup**: check for `vitest.config.*`, `pytest.ini`, `jest.config.*`, `*.test.*`, `conftest.py`
- **CI/CD**: check `.github/workflows/`, `.gitlab-ci.yml`, `Jenkinsfile`
- **Architecture**: check for API routes, frontend components, database schemas, microservices
- **Security**: check for auth, user input handling, external integrations

### 2. Select the appropriate skills

Map the repo's characteristics to the 70 available skills. Use the
[`skill-selection`](.github/agents/skill-selection/SKILL.md) skill as the
decision framework -- it contains the full mapping table.

**Every repo gets these mandatory skills:**
- `loop-engineering` -- the framework (how to work)
- `skill-selection` -- repo analysis (just completed)
- `testing` -- testing conventions
- `test-driven-development` -- TDD workflow
- `code-review-and-quality` -- review before merge
- `debugging-and-error-recovery` -- when things break
- `git-workflow-and-versioning` -- branching and commits

**Plus matched skills based on what was detected** (e.g. `typescript` if TS
detected, `ci-cd-and-automation` if GitHub Actions found, `security-and-hardening`
if auth exists, etc.)

### 3. Present the skill plan to the user

Tell the user what was found and which skills will be used:

```
I've analyzed your repository. Here's what I found:

  Languages: <detected>
  Frameworks: <detected>
  Tests: <detected or "none yet">
  CI/CD: <detected or "none yet">

Based on this, I'll use these skills to help you:

  MANDATORY: loop-engineering, skill-selection, testing, ...
  FOR YOUR CODEBASE: <language skills>, <framework skills>, ...
  AVAILABLE IF NEEDED: <on-demand skills>

Now -- what would you like to work on?
I'll approach it using Loop Engineering:
  Goal -> Action -> Observation -> Adjustment -> Stop
```

### 4. Then run Loop Engineering for the user's task

Once the user states their task, apply the Loop Engineering methodology using
the selected skills as domain guidance. See the next section for the full loop.

---

## MANDATORY: Loop Engineering

**Before doing any work in this repo, you MUST follow Loop Engineering.**

Loop Engineering replaces one-shot prompting with a self-correcting iterative
system. Instead of writing a prompt, getting a result, and moving on, you
design a **loop** that:

1. Defines a **recursive goal** with verifiable stopping criteria
2. Takes an **action** toward that goal
3. **Observes** the result (run tests, lint, typecheck, build)
4. **Adjusts** based on what the observation tells you
5. Repeats until the **stopping criteria** are met -- then stops

```
┌──────────────────────────────────────────────────────────┐
│                    RECURSIVE GOAL                         │
│        (evaluated every iteration -- keeps the            │
│         agent on task, prevents wasted cycles)            │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
                 ┌──────────────┐
                 │  1. GOAL      │  What is the verifiable target?
                 └──────┬───────┘
                        ▼
                 ┌──────────────┐
                 │  2. ACTION    │  Act: write code, run test, fix bug
                 └──────┬───────┘
                        ▼
                 ┌──────────────┐
                 │  3. OBSERVE   │  Evaluate: did it work? (CI, tests, lint)
                 └──────┬───────┘
                        ▼
                 ┌──────────────┐
                 │  4. ADJUST    │  Change approach based on observation
                 └──────┬───────┘
                        │
                        └──► Stopping criteria met? ──► YES ──► STOP
                        │                                NO
                        └────────────────────────────────┘
                                     (back to GOAL)
```

**Full framework documentation:** [`.github/agents/loop-engineering/SKILL.md`](.github/agents/loop-engineering/SKILL.md)

**User setup guide:** [`QA-SPEC-KIT.md`](QA-SPEC-KIT.md) -- how to set up this repo
and use the agents in any IDE for better QA answers.

---

## How to Approach Any Task in This Repo

### Step 1: Define the Recursive Goal

Before writing any code or running any command, write down:

```
GOAL: <what you are trying to achieve>
STOPPING CRITERIA: <how you will know you are done -- must be verifiable>
MAX ITERATIONS: <how many attempts before you stop and ask for help>
```

**Bad goal:** "Fix the tests" (vague, no termination)
**Good goal:** "All tests in tests/ pass and lint is clean" (specific, verifiable)

### Step 2: Identify Which Skills Apply

This repo ships **71 testing-focused skills** in [`.github/agents/`](.github/agents/).
Each skill is domain knowledge that gets applied *within* the loop -- they tell
the agent *how* to do something well, while Loop Engineering tells it *how to
work*.

Scan the skill descriptions in the index below. When a task matches a skill's
description, read that skill's `SKILL.md` before taking action.

### Step 3: Run the Loop

```
1. Read the current state (what exists, what's broken, what's needed)
2. Take the next action toward the goal (using relevant skills as guidance)
3. Observe the result (run tests, lint, typecheck, build -- get real output)
4. If stopping criteria are met -> STOP
5. If not -> adjust your approach and go back to step 1
```

### Step 4: Maker/Checker Verification

The agent that did the work must **not** be the one that verifies it.
A separate checker (a different agent, a CI pipeline, or a human) must
confirm the stopping criteria are genuinely met before the loop terminates.

This is not optional. The maker/checker split is the single most important
quality control in Loop Engineering.

### Step 5: Record Progress (Spine)

After each iteration, record what was done and what remains. This can be:
- A progress file in the repo
- A comment on a PR
- An update to this `AGENTS.md` if the project state changed

The agent forgets between runs. The repo doesn't. Write it down.

---

## The 5 Building Blocks + Spine

Every loop in this repo uses these components:

| Component | What it does | In this repo |
|-----------|-------------|--------------|
| **Automations** | Run the loop on a schedule | GitHub Actions workflows in `.github/workflows/` |
| **Worktrees** | Isolate parallel agent work | `git worktree` for parallel test agents |
| **Skills** | Codify project knowledge | 71 skills in `.github/agents/` |
| **Connectors** | Connect agent to real tools | MCP servers, test runners, CI systems |
| **Subagents** | Maker/checker split | One agent writes, a different agent verifies |
| **Spine** | Track what's done | This `AGENTS.md`, progress files, PR comments |

---

## Human-in-the-Loop

Even the most robust loops require human involvement. The agent does the work;
the human owns the outcome. Specifically, humans must:

- **Verify code** -- the checker agent is still just an agent
- **Prevent comprehension debt** -- understand what was generated, don't just accept it
- **Prevent intent debt** -- ensure the work serves the project's actual goals
- **Prevent cognitive surrender** -- never unquestioningly accept loop outputs

---

## Quick Setup (any IDE)

```powershell
# Windows -- links skills into Claude, Cursor, Windsurf, Devin folders
pwsh scripts/setup-agents.ps1
```

```bash
# macOS / Linux
bash scripts/setup-agents.sh
```

This creates directory junctions / symlinks from `.github/agents/` into each IDE's
expected skills folder. Junctions stay in sync automatically.

For IDE-specific manual setup, see [`.github/agents/README.md`](.github/agents/README.md).

---

## Skills Index (71 testing-focused skills)

These skills are **domain knowledge applied within loops**. Loop Engineering is
the framework; these skills are the expertise. When a task matches a skill's
description, read its `SKILL.md` and use its guidance inside the loop's Action step.

### Core Testing & TDD

| Skill | Description |
|-------|-------------|
| [testing](.github/agents/testing/SKILL.md) | Testing conventions: functional, performance, security; unit/integration/E2E; coverage; automation; defect tracking |
| [test-driven-development](.github/agents/test-driven-development/SKILL.md) | Drive development with tests -- prove code works before moving on |
| [tdd-workflow](.github/agents/tdd-workflow/SKILL.md) | Test-first thinking for high-risk technical work |
| [qa-test-matrix](.github/agents/qa-test-matrix/SKILL.md) | Coverage matrix: what to test, on which configs, at what milestone |
| [verification-loop](.github/agents/verification-loop/SKILL.md) | Structured verification pass: behavior, edge cases, quality bars |
| [bug-triage](.github/agents/bug-triage/SKILL.md) | Classify bugs by impact, reproducibility, severity, milestone risk |
| [crash-triage](.github/agents/crash-triage/SKILL.md) | Handle crashes as high-severity defects with reproducibility and clustering |
| [debugging-and-error-recovery](.github/agents/debugging-and-error-recovery/SKILL.md) | Systematic root-cause debugging when tests fail or builds break |

### Code Review & Quality

| Skill | Description |
|-------|-------------|
| [code-review-and-quality](.github/agents/code-review-and-quality/SKILL.md) | Multi-axis code review before merging any change |
| [brutal-honest](.github/agents/brutal-honest/SKILL.md) | Honest, evidence-backed code review with file:line proof |
| [reviewess](.github/agents/reviewess/SKILL.md) | Code review skill |
| [code-simplification](.github/agents/code-simplification/SKILL.md) | Simplify code for clarity without changing behavior |

### Performance Testing

| Skill | Description |
|-------|-------------|
| [performance-optimization](.github/agents/performance-optimization/SKILL.md) | Optimize frontend, backend, queries, databases; fix N+1, Core Web Vitals |
| [performance-budgeting](.github/agents/performance-budgeting/SKILL.md) | Set and manage frame, load, memory, streaming, bandwidth budgets |
| [web-performance](.github/agents/web-performance/SKILL.md) | Keep browser apps inside frame budget via allocation discipline and profiling |
| [unity-performance](.github/agents/unity-performance/SKILL.md) | Profile Unity projects based on player-build evidence, not editor intuition |
| [unreal-performance](.github/agents/unreal-performance/SKILL.md) | Profile packaged Unreal builds on target hardware |
| [godot-performance](.github/agents/godot-performance/SKILL.md) | Profile Godot runtime, scene, rendering, and resource behavior |

### CI/CD & Pipeline Testing

| Skill | Description |
|-------|-------------|
| [ci-cd-and-automation](.github/agents/ci-cd-and-automation/SKILL.md) | Automate CI/CD pipelines, quality gates, test runners in CI |
| [build-pipeline-patterns](.github/agents/build-pipeline-patterns/SKILL.md) | Reproducible, diagnosable, release-friendly build pipelines |
| [git-workflow-and-versioning](.github/agents/git-workflow-and-versioning/SKILL.md) | Git workflow: branching, committing, versioning, changelogs |
| [shipping-and-launch](.github/agents/shipping-and-launch/SKILL.md) | Pre-launch checklist, monitoring, staged rollout, rollback strategy |
| [release-readiness](.github/agents/release-readiness/SKILL.md) | Evaluate if a build is ready for external testing or launch |

### Security Testing

| Skill | Description |
|-------|-------------|
| [security-and-hardening](.github/agents/security-and-hardening/SKILL.md) | Harden code against vulnerabilities: input, auth, data, integrations |
| [compliance-checklists](.github/agents/compliance-checklists/SKILL.md) | Legal, accessibility, privacy, platform, product compliance checklists |

### Observability & Production Testing

| Skill | Description |
|-------|-------------|
| [observability-and-instrumentation](.github/agents/observability-and-instrumentation/SKILL.md) | Logging, metrics, tracing, alerting for production behavior |
| [telemetry-instrumentation](.github/agents/telemetry-instrumentation/SKILL.md) | Analytics and observability hooks that answer product questions |

### API & Contract Testing

| Skill | Description |
|-------|-------------|
| [api-and-interface-design](.github/agents/api-and-interface-design/SKILL.md) | Stable API and interface design: REST, GraphQL, module boundaries |
| [documentation](.github/agents/documentation/SKILL.md) | OpenAPI/Swagger specs, JSDoc/TSDoc, docstrings, contract-first conventions |
| [browser-testing-with-devtools](.github/agents/browser-testing-with-devtools/SKILL.md) | Test in real browsers: DOM inspection, console errors, network, profiling |

### Frontend & UI Testing

| Skill | Description |
|-------|-------------|
| [frontend-ui-engineering](.github/agents/frontend-ui-engineering/SKILL.md) | Production-quality, accessible, responsive UIs; WCAG requirements |
| [accessibility-design](.github/agents/accessibility-design/SKILL.md) | Build accessibility into design decisions, not as late-stage options |

### Language & Framework Skills (for writing tests)

| Skill | Description |
|-------|-------------|
| [python](.github/agents/python/SKILL.md) | Python 3.11+: mypy, async/await, pytest fixtures, dataclasses |
| [typescript](.github/agents/typescript/SKILL.md) | TypeScript: branded types, generics, utility types, strict tsconfig |
| [javascript](.github/agents/javascript/SKILL.md) | ES2023+ JS/Node: async/Promise, ESM/CJS, Web Workers, browser APIs |
| [csharp](.github/agents/csharp/SKILL.md) | C# 12 / .NET 8+: records, pattern matching, EF Core, CQRS with MediatR |
| [dotnet-core](.github/agents/dotnet-core/SKILL.md) | .NET 8 clean architecture, CQRS, minimal APIs, EF Core, JWT auth |
| [nestjs](.github/agents/nestjs/SKILL.md) | NestJS: modules, DI, DTOs, guards/interceptors/pipes, TypeORM/Prisma |
| [nextjs](.github/agents/nextjs/SKILL.md) | Next.js 14+ App Router: Server Components, Server Actions, caching |
| [react](.github/agents/react/SKILL.md) | React 18+/19: hooks, Server Components, Suspense, state management |
| [flutter](.github/agents/flutter/SKILL.md) | Flutter: project structure, core rules, performance, testing |

### Engine-Specific Testing

| Skill | Description |
|-------|-------------|
| [unity-testing](.github/agents/unity-testing/SKILL.md) | Unity testing: plain C#, edit mode, play mode, smoke testing |
| [unreal-testing](.github/agents/unreal-testing/SKILL.md) | Unreal automation and integration test layers |
| [godot-testing](.github/agents/godot-testing/SKILL.md) | Automated and manual test layers for Godot |
| [web-testing](.github/agents/web-testing/SKILL.md) | Browser testing: unit tests, headless smoke, browser matrix |

### Build & Release Testing

| Skill | Description |
|-------|-------------|
| [unity-build-release](.github/agents/unity-build-release/SKILL.md) | Unity builds, CI, release packaging with platform-aware checks |
| [unreal-build-release](.github/agents/unreal-build-release/SKILL.md) | Unreal builds, packaging, CI, release packaging |
| [godot-build-release](.github/agents/godot-build-release/SKILL.md) | Godot export, CI, release packaging with reproducible presets |
| [web-build-release](.github/agents/web-build-release/SKILL.md) | Build tooling and ship to static hosts with release hygiene |

### Certification & Compliance Testing

| Skill | Description |
|-------|-------------|
| [store-submission](.github/agents/store-submission/SKILL.md) | Store-facing assets, metadata, compliance, packaging for submission |
| [console-certification](.github/agents/console-certification/SKILL.md) | Console platform requirements: TRCs/TCRs/XRs, first-party submission |

### Migration Testing

| Skill | Description |
|-------|-------------|
| [deprecation-and-migration](.github/agents/deprecation-and-migration/SKILL.md) | Remove old systems, migrate users, decide maintain vs sunset |
| [legacy-modernization](.github/agents/legacy-modernization/SKILL.md) | Strangler fig, characterization tests, feature-flagged migration |

### Test Planning & Process

| Skill | Description |
|-------|-------------|
| [planning-and-task-breakdown](.github/agents/planning-and-task-breakdown/SKILL.md) | Break work into ordered, verifiable tasks with acceptance criteria |
| [risk-register](.github/agents/risk-register/SKILL.md) | Track risks that could derail scope, quality, budget, release readiness |
| [spec-driven-development](.github/agents/spec-driven-development/SKILL.md) | Create specs before coding; clarify ambiguous requirements |
| [spec-mining](.github/agents/spec-mining/SKILL.md) | Reverse-engineer legacy systems into EARS specs for test coverage |
| [doubt-driven-development](.github/agents/doubt-driven-development/SKILL.md) | Adversarial review before decisions stand; correctness over speed |
| [incremental-implementation](.github/agents/incremental-implementation/SKILL.md) | Deliver changes incrementally across multiple files |
| [technical-design-document](.github/agents/technical-design-document/SKILL.md) | Turn feature intent into an implementable, reviewable, testable TDD |
| [documentation-and-adrs](.github/agents/documentation-and-adrs/SKILL.md) | Record architectural decisions and context for future engineers |
| [continuous-learning](.github/agents/continuous-learning/SKILL.md) | Capture lessons from implementation, QA, and release |
| [source-driven-development](.github/agents/source-driven-development/SKILL.md) | Ground implementation in official docs; source-cited code |
| [context-engineering](.github/agents/context-engineering/SKILL.md) | Optimize agent context setup for testing sessions |
| [autoresearch](.github/agents/autoresearch/SKILL.md) | Autonomous iteration loop: modify, verify, keep/discard against metrics |

### Agent Orchestration (for running test loops)

| Skill | Description |
|-------|-------------|
| [skill-selection](.github/agents/skill-selection/SKILL.md) | **RUN FIRST**: Analyze repo, detect languages/frameworks/tests/CI, select appropriate skills |
| [orchestration-patterns](.github/agents/orchestration-patterns/SKILL.md) | Coordinate multiple test agents: maker/checker, explorer/implementer |
| [using-agent-skills](.github/agents/using-agent-skills/SKILL.md) | Discover and invoke agent skills at session start |
| [using-superpowers](.github/agents/using-superpowers/SKILL.md) | Establish skill discovery before any response |
| [agent-skills-system](.github/agents/agent-skills-system/SKILL.md) | Route tasks through phase-appropriate execution modes |
| [find-skills](.github/agents/find-skills/SKILL.md) | Discover and install agent skills |

---

## Skill Format

Each skill is a folder with `SKILL.md` containing YAML frontmatter and three
body sections. The frontmatter includes Loop Engineering metadata that tells
the agent how this skill fits into a loop:

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

The body has:
1. **Loop Engineering Execution** -- how this skill maps to Goal/Action/Observation/Adjustment
2. **Skill Guidance** -- the domain-specific instructions (the actual expertise)
3. **Verification Checklist** -- what a checker validates before the loop terminates

## Adding a New Skill

1. Create `.github/agents/<my-skill>/SKILL.md` with Evoveo Tech frontmatter
2. Add optional `references/` subfolder for detailed docs
3. Run `pwsh scripts/restructure-skills.ps1` to apply branding
4. Re-run `pwsh scripts/setup-agents.ps1` to link into IDE folders
5. Add an entry to this file in the appropriate category
