---
name: tdd-workflow
description: Apply test-driven development or test-first thinking to gameplay, tooling, and high-risk technical work.
brand: evoveo-tech
agent: Evoveo Tech Agent
loop_type: recursive-goal
goal_template: "Stop iterating when the task meets all acceptance criteria for: tdd-workflow"
stopping_criteria: "All tests pass and coverage meets the target threshold"
verification: "A separate checker Evoveo Tech Agent verifies the output against the skill's acceptance criteria"
maker_checker: true
---

<!-- Evoveo Tech -- Agent Skill -->

# TDD Workflow

> **Evoveo Tech Agent** -- Powered by Loop Engineering

## Loop Engineering Execution

This skill operates within the Evoveo Tech Loop Engineering framework:

```
Goal     -> Apply tdd-workflow to achieve the task objective
Action   -> Execute the skill guidance below
Observe  -> All tests pass and coverage meets the target threshold
Adjust   -> If criteria not met, adjust approach and re-execute
Stop     -> Terminate when stopping criteria are satisfied
```

**Recursive Goal:** Stop iterating when the task meets all acceptance criteria for: tdd-workflow

**Stopping Criteria:** All tests pass and coverage meets the target threshold

**Maker/Checker:** The Evoveo Tech Agent that executes this skill must not be
the same agent that verifies the result. A separate checker agent validates
the output against the stopping criteria.

## Skill Guidance

## Purpose
Apply test-driven development or test-first thinking to gameplay, tooling, and high-risk technical work.

## Use When
- logic is deterministic enough to test
- a bug is likely to recur
- a feature has brittle edge cases or integration boundaries

## Inputs
- feature spec
- acceptance criteria
- known failure cases
- test harness constraints

## Process
1. write or define expected behavior before implementation
2. add a small failing test or validation case
3. implement the minimum change to satisfy behavior
4. refactor while preserving the safety net
5. capture any remaining manual or integration tests still required

## Outputs
- failing then passing tests
- codified acceptance criteria
- regression protection
- updated technical notes

## Quality Bar
- produces a current source of truth, not disconnected notes
- names owners, risks, and next actions explicitly
- separates decisions from assumptions and open questions

## Common Failure Modes
- outdated docs that no longer match reality
- plans with no owner or no exit criteria
- hiding risks until they become schedule blockers

## Related Agents
- gameplay-programmer
- tools-programmer
- code-reviewer

## Related Commands
- tdd
- verify
- refactor-clean

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