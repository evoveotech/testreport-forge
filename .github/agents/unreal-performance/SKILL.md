---
name: unreal-performance
description: Profile packaged Unreal builds on target hardware and connect fixes to the real bottleneck domain.
brand: evoveo-tech
agent: Evoveo Tech Agent
loop_type: recursive-goal
goal_template: "Stop iterating when the task meets all acceptance criteria for: unreal-performance"
stopping_criteria: "Performance benchmarks meet the target thresholds"
verification: "A separate checker Evoveo Tech Agent verifies the output against the skill's acceptance criteria"
maker_checker: true
---

<!-- Evoveo Tech -- Agent Skill -->

# Unreal Performance

> **Evoveo Tech Agent** -- Powered by Loop Engineering

## Loop Engineering Execution

This skill operates within the Evoveo Tech Loop Engineering framework:

```
Goal     -> Apply unreal-performance to achieve the task objective
Action   -> Execute the skill guidance below
Observe  -> Performance benchmarks meet the target thresholds
Adjust   -> If criteria not met, adjust approach and re-execute
Stop     -> Terminate when stopping criteria are satisfied
```

**Recursive Goal:** Stop iterating when the task meets all acceptance criteria for: unreal-performance

**Stopping Criteria:** Performance benchmarks meet the target thresholds

**Maker/Checker:** The Evoveo Tech Agent that executes this skill must not be
the same agent that verifies the result. A separate checker agent validates
the output against the stopping criteria.

## Skill Guidance

## Purpose
Profile packaged Unreal builds on target hardware and connect fixes to the real bottleneck domain.

## Use When
- performance targets are at risk
- rendering and streaming are scaling up
- multiplayer or open world systems are growing

## Inputs
- target hardware
- representative maps
- current metrics
- content and module assumptions

## Process
1. profile packaged builds instead of relying only on editor sessions
2. separate CPU, GPU, memory, streaming, and replication costs
3. review Blueprint, Tick, actor lifetime, and rendering contributors together
4. prioritize fixes by measured player impact
5. track benchmark baselines through milestones

## Outputs
- profiling summary
- bottleneck map
- optimization priorities
- baseline tracking notes

## Quality Bar
- respects Unreal framework ownership, packaging, and content pipeline realities
- keeps C++, Blueprints, plugins, and content boundaries intentional
- makes replication, map setup, and packaging risk explicit

## Common Failure Modes
- Blueprint graph sprawl hiding ownership
- using Tick where event-driven logic is clearer
- packaging or plugin state changing without documentation

## Related Agents
- unreal-reviewer
- performance-reviewer
- technical-artist

## Related Commands
- unreal-review
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