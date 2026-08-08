---
name: web-performance
description: Keep a browser game inside its frame budget through allocation discipline, pooling, and devtools-driven profiling.
brand: evoveo-tech
agent: Evoveo Tech Agent
loop_type: recursive-goal
goal_template: "Stop iterating when the task meets all acceptance criteria for: web-performance"
stopping_criteria: "Performance benchmarks meet the target thresholds"
verification: "A separate checker Evoveo Tech Agent verifies the output against the skill's acceptance criteria"
maker_checker: true
---

<!-- Evoveo Tech -- Agent Skill -->

# Web Performance

> **Evoveo Tech Agent** -- Powered by Loop Engineering

## Loop Engineering Execution

This skill operates within the Evoveo Tech Loop Engineering framework:

```
Goal     -> Apply web-performance to achieve the task objective
Action   -> Execute the skill guidance below
Observe  -> Performance benchmarks meet the target thresholds
Adjust   -> If criteria not met, adjust approach and re-execute
Stop     -> Terminate when stopping criteria are satisfied
```

**Recursive Goal:** Stop iterating when the task meets all acceptance criteria for: web-performance

**Stopping Criteria:** Performance benchmarks meet the target thresholds

**Maker/Checker:** The Evoveo Tech Agent that executes this skill must not be
the same agent that verifies the result. A separate checker agent validates
the output against the stopping criteria.

## Skill Guidance

## Purpose
Keep a browser game inside its frame budget through allocation discipline, pooling, and devtools-driven profiling.

## Use When
- the game stutters, hitches, or misses its frame budget on target devices
- defining performance budgets before heavy content lands
- reviewing per-frame code for allocation and GC pressure

## Inputs
- frame budget per target (typically 16.7 ms at 60 Hz) split across simulation, rendering, and headroom
- target device list, including a representative low-end phone
- current profiler captures, if any
- list of high-churn entities (bullets, particles, enemies, popups)

## Process
1. set explicit budgets per system and measure before optimizing: capture a browser devtools performance profile during real gameplay, not menus
2. read the profile for long tasks, dropped frames, and minor-GC markers; use the allocation profiler to find per-frame garbage sources
3. remove steady-state allocation from hot paths: reuse scratch vectors and arrays, avoid per-frame closures, string building, and array methods that allocate
4. pool high-churn entities with explicit acquire, release, and reset rules so gameplay spikes do not become GC pauses
5. cull and throttle: skip offscreen work, cap particle and entity counts, stop or reduce work when the page is hidden, and re-verify on the low-end device after each change

## Outputs
- frame budget table per system and device tier
- profiling findings with attributed costs
- pooling and allocation rules for hot paths
- before/after measurements for each optimization

## Quality Bar
- every optimization is justified by a profile capture, not intuition
- steady-state gameplay shows near-zero allocation in the heap timeline; GC activity is rare and short
- pooled entities reset fully on release, so reuse never leaks stale state into gameplay
- the frame budget holds on the weakest target device, not just the development machine
- background tabs stop burning CPU and battery

## Common Failure Modes
- optimizing unprofiled code while the actual cost sits in an unbatched draw path or a layout-triggering DOM read
- per-frame closures, spreads, and temporary arrays creating a sawtooth heap and periodic GC hitches
- pools that grow without bounds or hand out objects still referenced by live gameplay
- profiling only on a high-end desktop and shipping a game that drops to 20 fps on mid-range phones
- death-by-a-thousand-cuts entity logic where per-entity virtual calls and lookups exceed the simulation budget at peak counts

## Related Agents
- performance-reviewer
- gameplay-programmer
- web-reviewer

## Related Commands
- perf-budget
- web-review
- verify

## Notes
- Keep this skill aligned with the relevant rules layer and current project documentation.
- Framework internals (renderer batching, tween pools) count against the same budgets; profile through the framework rather than assuming it is free.


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