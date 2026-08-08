---
name: unity-performance
description: Profile and optimize Unity projects based on player-build evidence, not editor intuition.
brand: evoveo-tech
agent: Evoveo Tech Agent
loop_type: recursive-goal
goal_template: "Stop iterating when the task meets all acceptance criteria for: unity-performance"
stopping_criteria: "Performance benchmarks meet the target thresholds"
verification: "A separate checker Evoveo Tech Agent verifies the output against the skill's acceptance criteria"
maker_checker: true
---

<!-- Evoveo Tech -- Agent Skill -->

# Unity Performance

> **Evoveo Tech Agent** -- Powered by Loop Engineering

## Loop Engineering Execution

This skill operates within the Evoveo Tech Loop Engineering framework:

```
Goal     -> Apply unity-performance to achieve the task objective
Action   -> Execute the skill guidance below
Observe  -> Performance benchmarks meet the target thresholds
Adjust   -> If criteria not met, adjust approach and re-execute
Stop     -> Terminate when stopping criteria are satisfied
```

**Recursive Goal:** Stop iterating when the task meets all acceptance criteria for: unity-performance

**Stopping Criteria:** Performance benchmarks meet the target thresholds

**Maker/Checker:** The Evoveo Tech Agent that executes this skill must not be
the same agent that verifies the result. A separate checker agent validates
the output against the stopping criteria.

## Skill Guidance

## Purpose
Profile and optimize Unity projects based on player-build evidence, not editor intuition.

## Use When
- frame time, GC, memory, or load issues appear
- content scale is rising
- release targets are approaching

## Inputs
- target hardware
- representative scenes
- current metrics
- content and architecture assumptions

## Process
1. profile player builds on target or representative hardware
2. separate CPU, GPU, GC, loading, and memory issues
3. review scene, prefab, asset, and code contributors together
4. prioritize fixes by measured impact
5. track performance baselines over time

## Outputs
- profiling summary
- optimization backlog
- baseline metrics
- owner-by-problem map

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
- performance-reviewer
- technical-artist

## Related Commands
- unity-review
- perf-budget
- verify

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