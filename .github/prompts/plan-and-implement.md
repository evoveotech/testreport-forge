# Plan and Implement a Feature

> **MANDATORY: Follow Loop Engineering.** Read `AGENTS.md` and
> `.github/agents/loop-engineering/SKILL.md` first.

## Step 1: Define the Recursive Goal

```
GOAL: Feature passes all acceptance criteria tests
STOPPING CRITERIA: All tests pass, lint is clean, types check
MAX ITERATIONS: 10
```

## Step 2: Run the Loop

1. **GOAL** -- What is the verifiable target? Write it down.
2. **ACTION** -- Break the feature into tasks using `planning-and-task-breakdown`.
   If no spec exists, use `spec-driven-development` to create one first.
   For each task, find the relevant skill in `.github/agents/` and read its `SKILL.md`.
3. **OBSERVE** -- After each action: run tests, lint, typecheck. Get real output.
4. **ADJUST** -- If tests fail or lint is dirty, fix the issue and re-execute.
5. **STOP** -- When all tests pass, lint is clean, and types check -- terminate.

## Step 3: Maker/Checker

The agent that implements must NOT verify the result. A separate checker agent
runs `code-review-and-quality` and the full test suite to confirm the stopping
criteria are genuinely met.

## Step 4: Record Progress (Spine)

Write what was done and what remains. The agent forgets between runs; the repo doesn't.

## Skills to Use

- `loop-engineering` -- the framework (READ FIRST)
- `planning-and-task-breakdown` -- break work into ordered, verifiable tasks
- `spec-driven-development` -- create specs if none exist
- `test-driven-development` -- write tests first, then implement
- `incremental-implementation` -- deliver changes incrementally
- `code-review-and-quality` -- multi-axis review before considering complete
- `git-workflow-and-versioning` -- branch, commit, version properly
