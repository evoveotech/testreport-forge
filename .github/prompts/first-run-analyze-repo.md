# First-Run: Analyze Repo & Select Skills

> **This is the first prompt to run when a new user opens the repo.**
> It analyzes the repository, selects the appropriate skills, and presents
> a skill plan before any work begins.

## Instructions

### Step 1: Analyze the Repository

Read `.github/agents/skill-selection/SKILL.md` and follow its analysis process.

Scan the repo for:
- Languages: `package.json`, `pyproject.toml`, `*.csproj`, `pubspec.yaml`, `tsconfig.json`
- Frameworks: check dependencies in package.json, pubspec.yaml, etc.
- Tests: `vitest.config.*`, `pytest.ini`, `jest.config.*`, `*.test.*`, `conftest.py`, `*.spec.*`
- CI/CD: `.github/workflows/*.yml`, `.gitlab-ci.yml`, `Jenkinsfile`
- Architecture: API routes, frontend components, database schemas, docker-compose
- Security: auth files, user input handling, external API integrations

### Step 2: Map Findings to Skills

Use the mapping table in `skill-selection/SKILL.md` to determine which of the
71 skills are relevant for this repo.

**Always include (mandatory for every repo):**
- `loop-engineering` -- the framework
- `skill-selection` -- repo analysis
- `testing` -- testing conventions
- `test-driven-development` -- TDD workflow
- `code-review-and-quality` -- review before merge
- `debugging-and-error-recovery` -- when things break
- `git-workflow-and-versioning` -- branching and commits

**Plus matched skills** based on what was detected in the repo.

### Step 3: Present the Skill Plan

Output a summary like:

```
I've analyzed your repository. Here's what I found:

  Languages: <detected>
  Frameworks: <detected>
  Tests: <detected or "none yet -- will use test-driven-development to establish">
  CI/CD: <detected or "none yet -- available if needed">
  Architecture: <detected>
  Security: <detected concerns or "none detected">

Based on this, I'll use these skills to help you:

  MANDATORY (every task):
    - loop-engineering (the framework: Goal -> Action -> Observe -> Adjust -> Stop)
    - skill-selection (repo analysis -- just completed)
    - testing (test conventions)
    - test-driven-development (TDD workflow)
    - code-review-and-quality (review before merge)
    - debugging-and-error-recovery (when things break)
    - git-workflow-and-versioning (branching and commits)

  FOR YOUR CODEBASE:
    - <language-skill> (detected: <evidence>)
    - <framework-skill> (detected: <evidence>)
    - <ci-skill> (detected: <evidence>)
    - <security-skill> (detected: <evidence>)
    ...

  AVAILABLE IF NEEDED:
    - performance-optimization (if perf issues arise)
    - browser-testing-with-devtools (for E2E tests)
    - planning-and-task-breakdown (for large tasks)
    - ...

Now, what would you like to work on?
I'll approach it using Loop Engineering:
  Goal -> Action -> Observation -> Adjustment -> Stop
```

### Step 4: Wait for the User's Task

Do not start any work yet. Present the plan and ask the user what they want
to work on. Once they respond, run Loop Engineering using the selected skills.
