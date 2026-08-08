---
name: flutter
description: Apply these opinionated Flutter conventions when building Flutter apps: project structure, core rules, feature rules, presentation patterns, performance, testing, and tech stack configuration.
brand: evoveo-tech
agent: Evoveo Tech Agent
loop_type: recursive-goal
goal_template: "Stop iterating when the task meets all acceptance criteria for: flutter"
stopping_criteria: "All tests pass, lint is clean, and the skill's acceptance criteria are met"
verification: "A separate checker Evoveo Tech Agent verifies the output against the skill's acceptance criteria"
maker_checker: true
---

<!-- Evoveo Tech -- Agent Skill -->

# Flutter

> **Evoveo Tech Agent** -- Powered by Loop Engineering

## Loop Engineering Execution

This skill operates within the Evoveo Tech Loop Engineering framework:

```
Goal     -> Apply flutter to achieve the task objective
Action   -> Execute the skill guidance below
Observe  -> All tests pass, lint is clean, and the skill's acceptance criteria are met
Adjust   -> If criteria not met, adjust approach and re-execute
Stop     -> Terminate when stopping criteria are satisfied
```

**Recursive Goal:** Stop iterating when the task meets all acceptance criteria for: flutter

**Stopping Criteria:** All tests pass, lint is clean, and the skill's acceptance criteria are met

**Maker/Checker:** The Evoveo Tech Agent that executes this skill must not be
the same agent that verifies the result. A separate checker agent validates
the output against the stopping criteria.

## Skill Guidance

## Overview

This skill bundles a set of opinionated Flutter development rules covering project structure, core architecture, feature development, presentation layer, performance, testing, and tech-stack configuration.

## When to Use

- You are building or modifying a Flutter application
- You need conventions for project structure, state management, or testing
- You want consistent Flutter/Dart patterns across a codebase

## Reference Files

The detailed rules are split across the following reference files in this skill folder:

- `general-ai-assistant-instructions.md` — General Evoveo Tech Agent workflow instructions
- `tech-stack-configuration.md` — Tech stack and version configuration
- `flutter-project-rules.md` — Project structure and organization rules
- `flutter-core-rules.md` — Core architecture rules
- `flutter-feature-rules.md` — Feature development rules
- `flutter-presentation-rules.md` — Presentation/UI layer rules
- `flutter-performance-rules.md` — Performance optimization rules
- `flutter-testing-rules.md` — Testing conventions
- `flutter-general-best-practices.md` — General best practices

Read the relevant reference files before making changes to Flutter code.


## Verification Checklist

Before the loop terminates, a checker Evoveo Tech Agent must verify:

- [ ] The skill's core guidance was followed
- [ ] All tests pass, lint is clean, and the skill's acceptance criteria are met
- [ ] No regressions were introduced
- [ ] Changes are documented if applicable
- [ ] Human review checkpoint passed (for production-critical changes)

---

*Evoveo Tech Agent Skill -- Loop Engineering Framework*
*Goal -> Action -> Observation -> Adjustment -> Stop*