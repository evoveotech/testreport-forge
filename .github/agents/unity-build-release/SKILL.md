---
name: unity-build-release
description: Run Unity builds, CI, and release packaging with reproducible configuration and platform-aware checks.
brand: evoveo-tech
agent: Evoveo Tech Agent
loop_type: recursive-goal
goal_template: "Stop iterating when the task meets all acceptance criteria for: unity-build-release"
stopping_criteria: "Build succeeds, CI is green, deployment artifacts are produced"
verification: "A separate checker Evoveo Tech Agent verifies the output against the skill's acceptance criteria"
maker_checker: true
---

<!-- Evoveo Tech -- Agent Skill -->

# Unity Build Release

> **Evoveo Tech Agent** -- Powered by Loop Engineering

## Loop Engineering Execution

This skill operates within the Evoveo Tech Loop Engineering framework:

```
Goal     -> Apply unity-build-release to achieve the task objective
Action   -> Execute the skill guidance below
Observe  -> Build succeeds, CI is green, deployment artifacts are produced
Adjust   -> If criteria not met, adjust approach and re-execute
Stop     -> Terminate when stopping criteria are satisfied
```

**Recursive Goal:** Stop iterating when the task meets all acceptance criteria for: unity-build-release

**Stopping Criteria:** Build succeeds, CI is green, deployment artifacts are produced

**Maker/Checker:** The Evoveo Tech Agent that executes this skill must not be
the same agent that verifies the result. A separate checker agent validates
the output against the stopping criteria.

## Skill Guidance

## Purpose
Run Unity builds, CI, and release packaging with reproducible configuration and platform-aware checks.

## Use When
- shipping Unity builds
- CI is fragile
- platform-specific build issues are frequent

## Inputs
- target platforms
- build configs
- package state
- release checklist

## Process
1. script build entry points and environment setup
2. capture Unity version, platform target, defines, and package state in logs
3. validate scenes, Addressables, localization, and platform assets before release candidates
4. treat each platform as its own risk surface
5. tie build output to release readiness

## Outputs
- Unity build pipeline notes
- platform risk list
- artifact and log expectations
- release validation targets

## Quality Bar
- respects Unity lifecycle, serialization, and content authoring realities
- keeps editor/runtime/test boundaries clean
- prevents scene, prefab, and package complexity from becoming hidden architecture

## Common Failure Modes
- inspector wiring being the only source of truth
- overusing MonoBehaviours or scene setup as architecture
- package or scene drift reaching release without review

## Related Agents
- unity-build-resolver
- build-engineer
- release-manager

## Related Commands
- unity-build-fix
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