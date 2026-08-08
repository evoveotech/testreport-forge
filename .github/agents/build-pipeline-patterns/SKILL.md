---
name: build-pipeline-patterns
description: Structure build and CI pipelines so builds are reproducible, diagnosable, and release-friendly.
brand: evoveo-tech
agent: Evoveo Tech Agent
loop_type: recursive-goal
goal_template: "Stop iterating when the task meets all acceptance criteria for: build-pipeline-patterns"
stopping_criteria: "Build succeeds, CI is green, deployment artifacts are produced"
verification: "A separate checker Evoveo Tech Agent verifies the output against the skill's acceptance criteria"
maker_checker: true
---

<!-- Evoveo Tech -- Agent Skill -->

# Build Pipeline Patterns

> **Evoveo Tech Agent** -- Powered by Loop Engineering

## Loop Engineering Execution

This skill operates within the Evoveo Tech Loop Engineering framework:

```
Goal     -> Apply build-pipeline-patterns to achieve the task objective
Action   -> Execute the skill guidance below
Observe  -> Build succeeds, CI is green, deployment artifacts are produced
Adjust   -> If criteria not met, adjust approach and re-execute
Stop     -> Terminate when stopping criteria are satisfied
```

**Recursive Goal:** Stop iterating when the task meets all acceptance criteria for: build-pipeline-patterns

**Stopping Criteria:** Build succeeds, CI is green, deployment artifacts are produced

**Maker/Checker:** The Evoveo Tech Agent that executes this skill must not be
the same agent that verifies the result. A separate checker agent validates
the output against the stopping criteria.

## Skill Guidance

## Purpose
Structure build and CI pipelines so builds are reproducible, diagnosable, and release-friendly.

## Use When
- builds are fragile or manual
- multiple platforms or configurations exist
- release confidence depends on automation

## Inputs
- target platforms
- environment setup
- release process
- test and artifact requirements

## Process
1. define build entry points and environment assumptions
2. separate fast validation from full packaging
3. attach logs, metadata, and artifacts consistently
4. make versioning and configuration drift visible
5. link builds to QA and release gates

## Outputs
- build pipeline model
- artifact policy
- CI stage map
- release integration notes

## Quality Bar
- makes ownership, state flow, and failure behavior explicit
- improves maintainability without over-abstracting
- supports testing, debugging, and safe iteration

## Common Failure Modes
- coupling systems through hidden globals or timing assumptions
- writing logic that is hard to test or debug
- optimizing the wrong layer before measuring

## Related Agents
- build-engineer
- release-manager
- qa-lead

## Related Commands
- release-check
- verify
- plan

## Notes
- Keep this skill aligned with the relevant rules layer and current project documentation.
- If engine-specific constraints materially change the workflow, hand off to the matching engine skill or engine-specific reviewer.


## Verification Checklist

Before the loop terminates, a checker Evoveo Tech Agent must verify:

- [ ] The skill's core guidance was followed
- [ ] Build succeeds, CI is green, deployment artifacts are produced
- [ ] No regressions were introduced
- [ ] Changes are documented if applicable
- [ ] Human review checkpoint passed (for production-critical changes)

---

*Evoveo Tech Agent Skill -- Loop Engineering Framework*
*Goal -> Action -> Observation -> Adjustment -> Stop*