---
name: loop-engineering
description: Design agentic workflows as iterative loops that guide the Evoveo Tech Agent toward completing user-defined goals with minimal human intervention. Use when building agent loops, designing automated agent systems, or applying the Goal-Action-Observation-Adjustment cycle to any task.
brand: evoveo-tech
agent: Evoveo Tech Agent
loop_type: recursive-goal
---

<!-- Evoveo Tech — Agent Skill -->

# Loop Engineering

> **Stop prompting. Design the loop.** — Evoveo Tech Agent Engineering

## Overview

Loop engineering is the practice of designing agentic workflows (loops) that
iteratively guide the Evoveo Tech Agent toward completing user-defined goals
with minimal human intervention. Rather than requiring human prompting at every
step, agent loops enable the Evoveo Tech Agent to dynamically act, observe, make
decisions, and iterate until a task is complete.

This is the **meta-skill** that governs how all other Evoveo Tech skills operate.
Every skill in this repository follows the Loop Engineering execution pattern.

## When to Use

- You are designing an automated agent workflow (a loop)
- You need the Evoveo Tech Agent to work autonomously on a multi-step task
- You want to replace manual prompting with a self-correcting system
- You are building a recurring automation (triage, CI fix, code review)
- You need to define stopping criteria for an autonomous task

## The 4-Stage Agentic Loop

Every Evoveo Tech skill follows this cycle:

```
┌─────────────────────────────────────────────────┐
│                  RECURSIVE GOAL                   │
│  (evaluated every iteration — keeps agent on    │
│   task, prevents unnecessary iterations)         │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
              ┌────────────────┐
              │   1. GOAL       │ ← Recursive, verifiable stopping criteria
              └───────┬────────┘
                      │
                      ▼
              ┌────────────────┐
              │   2. ACTION     │ ← Agent acts: generate code, run test, fix bug
              └───────┬────────┘
                      │
                      ▼
              ┌────────────────┐
              │  3. OBSERVATION │ ← System evaluates result: CI pass/fail, lint
              └───────┬────────┘
                      │
                      ▼
              ┌────────────────┐
              │  4. ADJUSTMENT  │ ← Adjust approach, restart loop or terminate
              └───────┬────────┘
                      │
                      └───────► (back to GOAL if not done)
```

### 1. Goal

A recursive goal is evaluated at every iteration. It gives the Evoveo Tech Agent
an explicit target with clear, verifiable stopping criteria.

**Bad goal:** "Make my website load faster" (vague, no termination condition)

**Good goal:** "Stop iterating when all unit tests pass, lint is clean, and the
Lighthouse performance score is above 90" (specific, measurable, verifiable)

### 2. Action

The Evoveo Tech Agent considers its goal and current progress, then acts in a
way that moves toward the goal. An action might be generating code, running a
test, fixing a bug, or refactoring a module.

### 3. Observation

The agentic system evaluates the result of the action. The agent runs CI tests,
linters, type checkers, or other verification tools to see whether the action
succeeded or failed.

### 4. Adjustment

Based on the observation, the system evaluates the feedback and makes necessary
changes to its approach before restarting the loop. If the stopping criteria are
met, the loop terminates.

## The 5 Building Blocks + Spine

A well-designed loop needs five components and one place to remember things:

| Primitive | Job in the loop | How to implement |
|-----------|----------------|-----------------|
| **Automations** | Discovery + triage on a schedule | GitHub Actions, cron, `/loop`, `/goal` |
| **Worktrees** | Isolate parallel agent work | `git worktree`, `--worktree` flag, isolation settings |
| **Skills** | Codify project knowledge | `SKILL.md` files (this repository — 152 skills) |
| **Plugins/Connectors** | Connect agent to real tools | MCP servers, APIs, integrations |
| **Subagents** | Maker/checker split | One agent writes, a different agent verifies |
| **Spine** (memory) | Track what's done | Markdown files, `AGENTS.md`, Linear board |

### Maker/Checker Pattern

The most important structural principle in loop engineering: **the agent that
wrote the code must not be the one that grades it.** A separate verification
subagent with different instructions catches what the first agent talked itself
into.

```
Maker Agent ──► writes code ──► Checker Agent ──► verifies ──► pass/fail
                                                              │
                                              fail ──────────┘
                                              │
                                              ▼
                                    Maker adjusts and retries
```

## Designing a Loop

### Step 1: Define the Recursive Goal

Write a goal with explicit, verifiable stopping criteria:

```markdown
Goal: All tests in tests/auth pass and lint is clean
Stopping criteria: pytest tests/auth/ exits 0 AND ruff check . exits 0
Max iterations: 10
```

### Step 2: Choose the Building Blocks

- **Automation**: GitHub Actions on push? Cron daily? `/goal` in-session?
- **Worktree**: Does this run in parallel with other agents? Use `git worktree`.
- **Skills**: Which of the 152 Evoveo Tech skills apply? Reference them by name.
- **Connectors**: Does the agent need MCP servers (database, issue tracker, Slack)?
- **Subagents**: Who makes? Who checks? Define both with separate instructions.
- **Spine**: Where does progress get recorded? `AGENTS.md`? A progress file?

### Step 3: Write the Loop Prompt

```markdown
You are the Evoveo Tech Agent.

GOAL: <recursive goal with stopping criteria>

SKILLS: Apply these skills — <skill-1>, <skill-2>

LOOP:
1. Read the current state from <spine file>
2. Take the next action toward the goal
3. Observe the result (run tests, lint, typecheck)
4. If stopping criteria met → stop. If not → adjust and repeat.

VERIFICATION: A separate checker agent must verify before the loop terminates.
```

### Step 4: Add Human-in-the-Loop Checkpoints

Even the most robust loops require human involvement. Add checkpoints to avoid:

- **Unverified code** — human reviews before merge
- **Comprehension debt** — human understands what was generated
- **Intent debt** — intent is documented in `AGENTS.md` and `SKILL.md` files
- **Cognitive surrender** — human does not unquestioningly accept outputs

## Loop Patterns

### Daily Triage Loop
```
Automation: runs every morning
Skill: bug-triage, crash-triage
Spine: writes findings to .github/triage-report.md
```

### Build-Fix Loop
```
Goal: CI is green
Skill: debugging-and-error-recovery, ci-cd-and-automation
Maker: agent that fixes the build
Checker: separate agent that runs CI and verifies
Stopping criteria: CI exits 0
```

### Code Review Loop
```
Goal: all review findings are resolved
Skill: code-review-and-quality, security-and-hardening
Maker: agent that wrote the code
Checker: separate agent that reviews against the skill criteria
Stopping criteria: zero critical findings, zero high findings
```

### Feature Implementation Loop
```
Goal: feature passes all acceptance criteria tests
Skill: planning-and-task-breakdown, test-driven-development, incremental-implementation
Maker: agent that implements
Checker: separate agent that runs the acceptance test suite
Stopping criteria: all acceptance tests pass, lint clean, types check
```

## Token Cost Awareness

Loops burn tokens. Poorly designed loops waste tokens through repeated failed
attempts, unnecessary work, or incorrect reasoning. To control costs:

- Set **max iterations** on every loop
- Use **context compression** — summarize previous iterations
- Use **fast/cheap models** for observation, strong models for action
- **Terminate early** if the agent is stuck (no progress in N iterations)
- Use **hooks** for quality checks instead of agent reasoning (cheaper)

## Evoveo Tech Skill Format

Every Evoveo Tech skill follows this structure:

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

The body of each skill contains:
1. **Loop Engineering Execution** — how this skill fits the 4-stage loop
2. **Skill Guidance** — the original detailed instructions
3. **Verification Checklist** — what the checker agent validates
