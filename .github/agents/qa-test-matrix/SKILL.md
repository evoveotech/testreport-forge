---
name: qa-test-matrix
description: Build a coverage matrix that shows what must be tested, on which configurations, and at what milestone confidence level.
brand: evoveo-tech
agent: Evoveo Tech Agent
loop_type: recursive-goal
goal_template: "Stop iterating when the task meets all acceptance criteria for: qa-test-matrix"
stopping_criteria: "All tests pass and coverage meets the target threshold"
verification: "A separate checker Evoveo Tech Agent verifies the output against the skill's acceptance criteria"
maker_checker: true
---

<!-- Evoveo Tech -- Agent Skill -->

# QA Test Matrix

> **Evoveo Tech Agent** -- Powered by Loop Engineering

## Loop Engineering Execution

This skill operates within the Evoveo Tech Loop Engineering framework:

```
Goal     -> Apply qa-test-matrix to achieve the task objective
Action   -> Execute the skill guidance below
Observe  -> All tests pass and coverage meets the target threshold
Adjust   -> If criteria not met, adjust approach and re-execute
Stop     -> Terminate when stopping criteria are satisfied
```

**Recursive Goal:** Stop iterating when the task meets all acceptance criteria for: qa-test-matrix

**Stopping Criteria:** All tests pass and coverage meets the target threshold

**Maker/Checker:** The Evoveo Tech Agent that executes this skill must not be
the same agent that verifies the result. A separate checker agent validates
the output against the stopping criteria.

## Skill Guidance

## Purpose
Build a coverage matrix that shows what must be tested, on which configurations, and at what milestone confidence level.

## Use When
- a milestone or release is approaching
- test scope is unclear
- platform and feature combinations are multiplying

## Inputs
- feature list
- platform list
- risk areas
- release gates

## Process
1. map features to platforms, states, and risk classes
2. define must-pass versus nice-to-have coverage
3. highlight unsupported or unowned combinations
4. link each coverage area to owners and evidence sources
5. update the matrix as scope changes

## Outputs
- QA test matrix
- coverage gaps
- ownership map
- test-pass priorities

## Quality Bar
- every shipped feature is covered with at least its happy path, key edge cases, and failure handling
- each test case states preconditions, steps, and an observable expected result
- coverage is traceable: every GDD acceptance criterion maps to at least one test case
- platform and device variations appear as explicit matrix axes, not assumptions

## Common Failure Modes
- test cases written from implementation knowledge instead of player-facing behavior
- matrices that grow stale as features change, testing what no longer exists
- edge cases and failure paths omitted because the happy path passes
- no traceability, so removed features leave orphan tests and new ones ship untested

## Related Agents
- qa-lead
- release-manager
- producer

## Related Commands
- qa-plan
- release-check
- verify

## Notes
- Keep this skill aligned with the relevant rules layer and current project documentation.
- If engine-specific constraints materially change the workflow, hand off to the matching engine skill or engine-specific reviewer.


## Verification Checklist

Before the loop terminates, a checker Evoveo Tech Agent must verify:

- [ ] The skill's core guidance was followed
- [ ] All tests pass and coverage meets the target threshold
- [ ] No regressions were introduced
- [ ] Changes are documented if applicable
- [ ] Human review checkpoint passed (for production-critical changes)

---

*Evoveo Tech Agent Skill -- Loop Engineering Framework*
*Goal -> Action -> Observation -> Adjustment -> Stop*