---
name: unity-testing
description: Choose the right mix of plain C#, edit mode, play mode, and smoke testing for Unity features.
brand: evoveo-tech
agent: Evoveo Tech Agent
loop_type: recursive-goal
goal_template: "Stop iterating when the task meets all acceptance criteria for: unity-testing"
stopping_criteria: "All tests pass and coverage meets the target threshold"
verification: "A separate checker Evoveo Tech Agent verifies the output against the skill's acceptance criteria"
maker_checker: true
---

<!-- Evoveo Tech -- Agent Skill -->

# Unity Testing

> **Evoveo Tech Agent** -- Powered by Loop Engineering

## Loop Engineering Execution

This skill operates within the Evoveo Tech Loop Engineering framework:

```
Goal     -> Apply unity-testing to achieve the task objective
Action   -> Execute the skill guidance below
Observe  -> All tests pass and coverage meets the target threshold
Adjust   -> If criteria not met, adjust approach and re-execute
Stop     -> Terminate when stopping criteria are satisfied
```

**Recursive Goal:** Stop iterating when the task meets all acceptance criteria for: unity-testing

**Stopping Criteria:** All tests pass and coverage meets the target threshold

**Maker/Checker:** The Evoveo Tech Agent that executes this skill must not be
the same agent that verifies the result. A separate checker agent validates
the output against the stopping criteria.

## Skill Guidance

## Purpose
Choose the right mix of plain C#, edit mode, play mode, and smoke testing for Unity features.

## Use When
- adding Unity tests
- test suites are slow or brittle
- engine-specific regressions are slipping through

## Inputs
- feature risk profile
- test harness availability
- scene dependencies
- CI limits

## Process
1. push deterministic logic into plain C# tests where possible
2. use edit mode for engine-integrated but non-playmode logic
3. reserve play mode for lifecycle and integration-sensitive behavior
4. stabilize fixtures and scene assumptions
5. mark gating versus informational suites explicitly

## Outputs
- test-layer strategy
- candidate test cases
- CI coverage notes
- flakiness reduction plan

## Quality Bar
- respects Unity lifecycle, serialization, and content authoring realities
- keeps editor/runtime/test boundaries clean
- prevents scene, prefab, and package complexity from becoming hidden architecture

## Common Failure Modes
- inspector wiring being the only source of truth
- overusing MonoBehaviours or scene setup as architecture
- package or scene drift reaching release without review

## Related Agents
- unity-reviewer
- qa-lead
- gameplay-programmer

## Related Commands
- unity-review
- verify
- qa-plan

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