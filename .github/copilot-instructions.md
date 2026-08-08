# GitHub Copilot Instructions -- Evoveo Tech | Loop Engineering

> **Stop prompting. Design the loop.**

## FIRST-TIME USER PROTOCOL (run this before answering anything)

When a user interacts with this repo for the first time, you MUST:

### 1. Analyze the repo

Scan the repository to understand what it is:
- **Languages**: `package.json`, `pyproject.toml`, `*.csproj`, `pubspec.yaml`, etc.
- **Frameworks**: dependencies (React, Next.js, NestJS, Flutter, Unity, etc.)
- **Tests**: `vitest.config.*`, `pytest.ini`, `jest.config.*`, `*.test.*`, `conftest.py`
- **CI/CD**: `.github/workflows/`, `.gitlab-ci.yml`, `Jenkinsfile`
- **Architecture**: API routes, frontend components, database schemas
- **Security**: auth, user input, external integrations

### 2. Select appropriate skills

Use `.github/agents/skill-selection/SKILL.md` as the decision framework.
It contains the full mapping table from repo characteristics to skills.

**Always include:** `loop-engineering`, `skill-selection`, `testing`,
`test-driven-development`, `code-review-and-quality`, `debugging-and-error-recovery`,
`git-workflow-and-versioning`

**Plus matched skills** based on what was detected.

### 3. Present the plan

Tell the user what you found and which skills you'll use:

```
I've analyzed your repository:
  Languages: <detected>
  Frameworks: <detected>
  Tests: <detected or "none yet">
  CI/CD: <detected or "none yet">

I'll use these skills:
  MANDATORY: loop-engineering, skill-selection, testing, ...
  FOR YOUR CODEBASE: <language/framework skills>
  AVAILABLE IF NEEDED: <on-demand skills>

What would you like to work on?
```

### 4. Run Loop Engineering for the task

Once the user states their task, apply the loop using the selected skills.

---

## MANDATORY: Loop Engineering

Before doing any work, follow Loop Engineering:

```
1. GOAL      -- Define a recursive goal with verifiable stopping criteria
2. ACTION    -- Act toward the goal (using relevant skills as guidance)
3. OBSERVE   -- Evaluate the result (run tests, lint, typecheck, build)
4. ADJUST    -- Change approach based on what the observation tells you
5. STOP      -- Terminate when stopping criteria are met
```

**Full framework:** `.github/agents/loop-engineering/SKILL.md`
**Repo entry point:** `AGENTS.md` (root)

### Maker/Checker

The agent that did the work must NOT verify it. A separate checker (different
agent, CI, or human) must confirm the stopping criteria are genuinely met.

### Spine (Memory)

After each iteration, record what was done and what remains. The agent forgets
between runs; the repo doesn't. Write it down.

---

## Skills (71 testing-focused)

This repo ships **71 skills** in `.github/agents/`. Loop Engineering is the
framework; these skills are the domain expertise loaded into the loop.

See `AGENTS.md` for the complete categorized index.

### Key Skills

- `skill-selection` -- **RUN FIRST**: analyze repo, select appropriate skills
- `loop-engineering` -- the framework documentation
- `testing` -- testing conventions: functional, performance, security
- `test-driven-development` -- write tests first, then implement
- `code-review-and-quality` -- multi-axis review before merging
- `debugging-and-error-recovery` -- systematic root-cause debugging
- `ci-cd-and-automation` -- automate build and deployment pipelines
- `qa-test-matrix` -- coverage matrix for configurations and milestones
- `verification-loop` -- structured verification pass

### Skill Format

```yaml
---
name: skill-name
description: When to use this skill...
brand: evoveo-tech
agent: Evoveo Tech Agent
loop_type: recursive-goal
goal_template: "Stop iterating when <verifiable condition>"
stopping_criteria: "<test command or check>"
verification: "A separate checker Evoveo Tech Agent verifies..."
maker_checker: true
---
```

Read `name` and `description` to decide when a skill applies.
Follow `stopping_criteria` to know when the loop terminates.
