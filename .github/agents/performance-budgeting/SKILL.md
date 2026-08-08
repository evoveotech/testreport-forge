---
name: performance-budgeting
description: Set and manage frame, load, memory, streaming, or bandwidth budgets before performance debt becomes structural.
brand: evoveo-tech
agent: Evoveo Tech Agent
loop_type: recursive-goal
goal_template: "Stop iterating when the task meets all acceptance criteria for: performance-budgeting"
stopping_criteria: "Performance benchmarks meet the target thresholds"
verification: "A separate checker Evoveo Tech Agent verifies the output against the skill's acceptance criteria"
maker_checker: true
---

<!-- Evoveo Tech -- Agent Skill -->

# Performance Budgeting

> **Evoveo Tech Agent** -- Powered by Loop Engineering

## Loop Engineering Execution

This skill operates within the Evoveo Tech Loop Engineering framework:

```
Goal     -> Apply performance-budgeting to achieve the task objective
Action   -> Execute the skill guidance below
Observe  -> Performance benchmarks meet the target thresholds
Adjust   -> If criteria not met, adjust approach and re-execute
Stop     -> Terminate when stopping criteria are satisfied
```

**Recursive Goal:** Stop iterating when the task meets all acceptance criteria for: performance-budgeting

**Stopping Criteria:** Performance benchmarks meet the target thresholds

**Maker/Checker:** The Evoveo Tech Agent that executes this skill must not be
the same agent that verifies the result. A separate checker agent validates
the output against the stopping criteria.

## Skill Guidance

## Purpose
Set and manage frame, load, memory, streaming, or bandwidth budgets before performance debt becomes structural.

## Use When
- target hardware is defined
- performance problems are emerging
- content scale is increasing

## Inputs
- target platforms
- feature set
- technical architecture
- content assumptions

## Process
1. set budgets by platform and major runtime mode
2. allocate budget ownership by system or content class
3. choose representative benchmark scenarios
4. review regressions at milestone checkpoints
5. link descopes or optimization work to measured overages

## Outputs
- budget sheet
- owner-by-budget map
- benchmark scenarios
- regression review cadence

## Quality Bar
- budgets are set per system (frame time, memory, draw calls, asset sizes) against the weakest target device
- every budget has an owner and a repeatable measurement method
- regressions are caught by measurement at integration time, not discovered in QA
- budget exceptions are negotiated and recorded, not silently absorbed

## Common Failure Modes
- budgets defined as totals with no per-system allocation, so no one owns overruns
- profiling only on developer hardware, missing the real target floor
- performance treated as a polish-phase task instead of a standing budget
- one-off optimizations that decay because no measurement guards them

## Related Agents
- performance-reviewer
- producer
- technical-artist

## Related Commands
- perf-budget
- verify
- release-check

## Notes
- Keep this skill aligned with the relevant rules layer and current project documentation.
- If engine-specific constraints materially change the workflow, hand off to the matching engine skill or engine-specific reviewer.


## Verification Checklist

Before the loop terminates, a checker Evoveo Tech Agent must verify:

- [ ] The skill's core guidance was followed
- [ ] Performance benchmarks meet the target thresholds
- [ ] No regressions were introduced
- [ ] Changes are documented if applicable
- [ ] Human review checkpoint passed (for production-critical changes)

---

*Evoveo Tech Agent Skill -- Loop Engineering Framework*
*Goal -> Action -> Observation -> Adjustment -> Stop*