---
name: godot-build-release
description: Run Godot export, CI, and release packaging with reproducible presets and platform-aware checks.
brand: evoveo-tech
agent: Evoveo Tech Agent
loop_type: recursive-goal
goal_template: "Stop iterating when the task meets all acceptance criteria for: godot-build-release"
stopping_criteria: "Build succeeds, CI is green, deployment artifacts are produced"
verification: "A separate checker Evoveo Tech Agent verifies the output against the skill's acceptance criteria"
maker_checker: true
---

<!-- Evoveo Tech -- Agent Skill -->

# Godot Build Release

> **Evoveo Tech Agent** -- Powered by Loop Engineering

## Loop Engineering Execution

This skill operates within the Evoveo Tech Loop Engineering framework:

```
Goal     -> Apply godot-build-release to achieve the task objective
Action   -> Execute the skill guidance below
Observe  -> Build succeeds, CI is green, deployment artifacts are produced
Adjust   -> If criteria not met, adjust approach and re-execute
Stop     -> Terminate when stopping criteria are satisfied
```

**Recursive Goal:** Stop iterating when the task meets all acceptance criteria for: godot-build-release

**Stopping Criteria:** Build succeeds, CI is green, deployment artifacts are produced

**Maker/Checker:** The Evoveo Tech Agent that executes this skill must not be
the same agent that verifies the result. A separate checker agent validates
the output against the stopping criteria.

## Skill Guidance

## Purpose
Run Godot export, CI, and release packaging with reproducible presets and platform-aware checks.

## Use When
- shipping Godot builds
- export presets are fragile
- platform packaging issues are recurring

## Inputs
- export presets
- target platforms
- addon state
- release checklist

## Process
1. script or standardize export entry points
2. capture Godot version, export preset, platform target, and addon state in logs
3. validate startup, resources, localization, and platform assets before release candidates
4. treat each platform as its own risk surface
5. tie exports to QA and release readiness

## Outputs
- Godot build pipeline notes
- platform risk list
- artifact expectations
- release validation targets

## Quality Bar
- respects scene-tree ownership, autoload boundaries, and resource behavior
- keeps scripts, signals, and resources understandable at scale
- supports export reliability and content iteration without hidden coupling

## Common Failure Modes
- autoloads becoming global dumping grounds
- signal webs with no ownership
- shared resources causing accidental state leakage

## Related Agents
- godot-build-resolver
- build-engineer
- release-manager

## Related Commands
- godot-build-fix
- release-check
- verify

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