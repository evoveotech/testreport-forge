---
name: godot-performance
description: Profile Godot runtime, scene, rendering, and resource behavior based on representative builds and content.
brand: evoveo-tech
agent: Evoveo Tech Agent
loop_type: recursive-goal
goal_template: "Stop iterating when the task meets all acceptance criteria for: godot-performance"
stopping_criteria: "Performance benchmarks meet the target thresholds"
verification: "A separate checker Evoveo Tech Agent verifies the output against the skill's acceptance criteria"
maker_checker: true
---

<!-- Evoveo Tech -- Agent Skill -->

# Godot Performance

> **Evoveo Tech Agent** -- Powered by Loop Engineering

## Loop Engineering Execution

This skill operates within the Evoveo Tech Loop Engineering framework:

```
Goal     -> Apply godot-performance to achieve the task objective
Action   -> Execute the skill guidance below
Observe  -> Performance benchmarks meet the target thresholds
Adjust   -> If criteria not met, adjust approach and re-execute
Stop     -> Terminate when stopping criteria are satisfied
```

**Recursive Goal:** Stop iterating when the task meets all acceptance criteria for: godot-performance

**Stopping Criteria:** Performance benchmarks meet the target thresholds

**Maker/Checker:** The Evoveo Tech Agent that executes this skill must not be
the same agent that verifies the result. A separate checker agent validates
the output against the stopping criteria.

## Skill Guidance

## Purpose
Profile Godot runtime, scene, rendering, and resource behavior based on representative builds and content.

## Use When
- performance targets are at risk
- scene and resource complexity is rising
- platform exports are diverging

## Inputs
- target hardware
- representative scenes
- current metrics
- content and architecture assumptions

## Process
1. profile representative exported builds or representative runtime conditions
2. separate script, rendering, memory, and scene-tree costs
3. review signal churn, node count, resource loading, and draw behavior together
4. prioritize changes by measured impact
5. track baseline metrics through milestones

## Outputs
- profiling summary
- bottleneck map
- optimization priorities
- baseline notes

## Quality Bar
- respects scene-tree ownership, autoload boundaries, and resource behavior
- keeps scripts, signals, and resources understandable at scale
- supports export reliability and content iteration without hidden coupling

## Common Failure Modes
- autoloads becoming global dumping grounds
- signal webs with no ownership
- shared resources causing accidental state leakage

## Related Agents
- godot-reviewer
- performance-reviewer
- technical-artist

## Related Commands
- godot-review
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