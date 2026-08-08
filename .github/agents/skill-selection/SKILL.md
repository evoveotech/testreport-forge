---
name: skill-selection
description: Analyze the repository and select the appropriate skills for the user's task. ALWAYS run first when a new user opens the repo or when the task scope is unclear. Maps repo characteristics (languages, frameworks, test setup, CI, architecture) to the 70 available skills, then presents a skill plan before proceeding with Loop Engineering.
brand: evoveo-tech
agent: Evoveo Tech Agent
loop_type: recursive-goal
goal_template: "Stop iterating when the repo is analyzed and a skill plan is presented to the user"
stopping_criteria: "Repo analysis is complete, relevant skills are identified, and a skill plan is presented"
verification: "A separate checker Evoveo Tech Agent confirms the skill plan covers all relevant repo characteristics"
maker_checker: true
---

<!-- Evoveo Tech -- Agent Skill -->

# Skill Selection

> **Evoveo Tech Agent** -- Powered by Loop Engineering

## Loop Engineering Execution

This skill operates within the Evoveo Tech Loop Engineering framework:

```
Goal     -> Analyze the repo and select the best skills for the user's task
Action   -> Scan repo files, detect languages/frameworks/tests/CI, map to skills
Observe  -> Review the detected characteristics against available skill descriptions
Adjust   -> If gaps found, add more skills; if over-selected, trim to essentials
Stop     -> Skill plan is complete, covers all relevant repo characteristics, presented to user
```

**Recursive Goal:** Stop iterating when the repo is analyzed and a skill plan is presented

**Stopping Criteria:** Repo analysis is complete, relevant skills are identified, and a skill plan is presented

**Maker/Checker:** The Evoveo Tech Agent that selects skills must not be the same
agent that verifies the selection covers all relevant repo characteristics.

## Skill Guidance

### When to Run This

**ALWAYS run this first when:**
- A new user opens the repo for the first time
- A user asks a question and you don't yet know which skills apply
- The task scope is unclear or could touch multiple domains
- You are starting a new session and haven't analyzed the repo yet

### Step 1: Analyze the Repository

Scan the repo to understand what kind of project this is. Look for:

#### Language & Runtime Detection
| What to look for | Files to check | What it tells you |
|-----------------|---------------|-------------------|
| Python | `pyproject.toml`, `setup.py`, `requirements.txt`, `*.py` | Use `python` skill |
| TypeScript | `tsconfig.json`, `*.ts`, `*.tsx` | Use `typescript` skill |
| JavaScript | `package.json`, `*.js`, `*.mjs` | Use `javascript` skill |
| C# / .NET | `*.csproj`, `*.sln`, `Program.cs` | Use `csharp` and/or `dotnet-core` skill |
| Dart / Flutter | `pubspec.yaml`, `*.dart` | Use `flutter` skill |

#### Framework Detection
| What to look for | Files to check | What it tells you |
|-----------------|---------------|-------------------|
| React | `package.json` with `react` dependency | Use `react` skill |
| Next.js | `package.json` with `next` dependency, `app/` or `pages/` | Use `nextjs` skill |
| NestJS | `package.json` with `@nestjs/core` | Use `nestjs` skill |
| Unity | `ProjectSettings/`, `*.unity`, `Assets/` | Use `unity-testing`, `unity-build-release` |
| Unreal | `*.uproject`, `Source/`, `Content/` | Use `unreal-testing`, `unreal-build-release` |
| Godot | `project.godot`, `*.tscn` | Use `godot-testing`, `godot-build-release` |

#### Test Setup Detection
| What to look for | Files to check | What it tells you |
|-----------------|---------------|-------------------|
| pytest | `pytest.ini`, `conftest.py`, `test_*.py` | Python testing -- use `testing` + `test-driven-development` |
| Jest/Vitest | `jest.config.*`, `vitest.config.*`, `*.test.ts` | JS/TS testing -- use `testing` + `test-driven-development` |
| NUnit/xUnit | `*.csproj` with `xunit` or `nunit` | C# testing -- use `testing` + `test-driven-development` |
| Playwright | `playwright.config.*` | E2E testing -- use `browser-testing-with-devtools` |
| No tests found | None of the above | Use `test-driven-development` to establish testing |

#### CI/CD Detection
| What to look for | Files to check | What it tells you |
|-----------------|---------------|-------------------|
| GitHub Actions | `.github/workflows/*.yml` | Use `ci-cd-and-automation` + `build-pipeline-patterns` |
| GitLab CI | `.gitlab-ci.yml` | Use `ci-cd-and-automation` + `build-pipeline-patterns` |
| Jenkins | `Jenkinsfile` | Use `ci-cd-and-automation` + `build-pipeline-patterns` |
| No CI found | None of the above | Use `ci-cd-and-automation` to set up |

#### Architecture Detection
| What to look for | Files to check | What it tells you |
|-----------------|---------------|-------------------|
| API endpoints | `openapi.yaml`, routes, controllers | Use `api-and-interface-design` + `documentation` |
| Frontend UI | components, pages, layouts | Use `frontend-ui-engineering` + `accessibility-design` |
| Database | migrations, ORM models, `prisma.schema` | Use `testing` (integration tests) |
| Microservices | multiple services, docker-compose | Use `orchestration-patterns` |

#### Security & Compliance
| What to look for | Files to check | What it tells you |
|-----------------|---------------|-------------------|
| Auth | JWT, OAuth, session management | Use `security-and-hardening` |
| User input | forms, API endpoints accepting input | Use `security-and-hardening` |
| Compliance | GDPR, HIPAA, PCI references | Use `compliance-checklists` |

### Step 2: Map Findings to Skills

After scanning the repo, create a skill plan:

```
REPO ANALYSIS:
  Languages: <detected>
  Frameworks: <detected>
  Test setup: <detected or "none">
  CI/CD: <detected or "none">
  Architecture: <detected>
  Security concerns: <detected>

SELECTED SKILLS:
  [Always]  loop-engineering        -- the framework (mandatory)
  [Always]  skill-selection          -- you are here
  [Matched] <skill-name>             -- <reason: detected X in repo>
  [Matched] <skill-name>             -- <reason: detected Y in repo>
  ...

SKILL PLAN:
  For this repo, the agent will use these skills when:
  - Writing tests: testing, test-driven-development, <language-skill>
  - Reviewing code: code-review-and-quality, brutal-honest
  - Running CI: ci-cd-and-automation, build-pipeline-patterns
  - Debugging: debugging-and-error-recovery
  - <other relevant mappings>
```

### Step 3: Present the Plan to the User

Before doing any work, tell the user:

```
I've analyzed your repository and here's what I found:

  - Language: TypeScript with React and Next.js
  - Tests: Vitest (configured)
  - CI: GitHub Actions (3 workflows)
  - Architecture: API routes + frontend components

Based on this, I'll use these skills to help you:

  MANDATORY:
  - loop-engineering (the framework for every task)
  - skill-selection (repo analysis -- just completed)

  FOR YOUR CODEBASE:
  - typescript (TypeScript conventions)
  - react (React patterns)
  - nextjs (Next.js App Router)
  - testing (test conventions)
  - test-driven-development (TDD workflow)
  - code-review-and-quality (review before merge)
  - ci-cd-and-automation (your GitHub Actions)
  - debugging-and-error-recovery (when things break)
  - git-workflow-and-versioning (branching and commits)
  - security-and-hardening (you have auth endpoints)

  AVAILABLE IF NEEDED:
  - performance-optimization (if perf issues arise)
  - browser-testing-with-devtools (for E2E tests)
  - frontend-ui-engineering (for UI work)
  - accessibility-design (for WCAG compliance)

Now, what would you like to work on? I'll approach it using
Loop Engineering: Goal -> Action -> Observation -> Adjustment -> Stop.
```

### Step 4: Use Selected Skills in the Loop

Once the user states their task, run Loop Engineering using the selected skills:

1. **GOAL** -- Define the recursive goal with verifiable stopping criteria
2. **ACTION** -- Use the relevant selected skills as guidance for the action
3. **OBSERVE** -- Run tests, lint, typecheck, build -- get real output
4. **ADJUST** -- If criteria not met, adjust using skill guidance
5. **STOP** -- Terminate when stopping criteria are satisfied

### Skill Selection Rules

**Always include (mandatory for every repo):**
- `loop-engineering` -- the framework
- `skill-selection` -- repo analysis (this skill)
- `testing` -- testing conventions (every repo needs tests)
- `test-driven-development` -- TDD workflow
- `code-review-and-quality` -- review before merge
- `debugging-and-error-recovery` -- when things break
- `git-workflow-and-versioning` -- branching and commits

**Include when detected:**
- Language skills (`python`, `typescript`, `javascript`, `csharp`, `dotnet-core`) -- match the repo's languages
- Framework skills (`react`, `nextjs`, `nestjs`, `flutter`) -- match the repo's frameworks
- `ci-cd-and-automation` -- when CI config files exist
- `build-pipeline-patterns` -- when build configs exist
- `security-and-hardening` -- when auth, user input, or external integrations exist
- `api-and-interface-design` -- when API endpoints exist
- `browser-testing-with-devtools` -- when Playwright or browser testing exists
- `frontend-ui-engineering` -- when frontend components exist
- `accessibility-design` -- when UI exists
- `performance-optimization` -- when performance is a concern
- `observability-and-instrumentation` -- when production monitoring exists

**Include on demand (when the task requires):**
- `planning-and-task-breakdown` -- for large tasks
- `spec-driven-development` -- when no spec exists
- `qa-test-matrix` -- for comprehensive test planning
- `risk-register` -- for risky changes
- `brutal-honest` -- for harsh code review
- `verification-loop` -- for final verification
- `deprecation-and-migration` -- when removing old systems
- `legacy-modernization` -- when modernizing old code
- `release-readiness` -- before launch
- `shipping-and-launch` -- for production deployment
- `compliance-checklists` -- for compliance work
- `store-submission` / `console-certification` -- for app store submission

## Verification Checklist

Before the loop terminates, a checker Evoveo Tech Agent must verify:

- [ ] The repo was scanned for languages, frameworks, tests, CI, architecture, security
- [ ] Detected characteristics are accurate (not hallucinated)
- [ ] Selected skills map to actual repo characteristics
- [ ] No critical skills are missing from the plan
- [ ] The skill plan was presented to the user
- [ ] The user knows which skills will be used and why
