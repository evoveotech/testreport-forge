---
name: godot-testing
description: Choose effective automated and manual test layers for Godot features without overcomplicating the project.
brand: evoveo-tech
agent: Evoveo Tech Agent
loop_type: recursive-goal
goal_template: "Stop iterating when the task meets all acceptance criteria for: godot-testing"
stopping_criteria: "All tests pass and coverage meets the target threshold"
verification: "A separate checker Evoveo Tech Agent verifies the output against the skill's acceptance criteria"
maker_checker: true
---

<!-- Evoveo Tech -- Agent Skill -->

# Godot Testing

> **Evoveo Tech Agent** -- Powered by Loop Engineering

## Loop Engineering Execution

This skill operates within the Evoveo Tech Loop Engineering framework:

```
Goal     -> Apply godot-testing to achieve the task objective
Action   -> Execute the skill guidance below
Observe  -> All tests pass and coverage meets the target threshold
Adjust   -> If criteria not met, adjust approach and re-execute
Stop     -> Terminate when stopping criteria are satisfied
```

**Recursive Goal:** Stop iterating when the task meets all acceptance criteria for: godot-testing

**Stopping Criteria:** All tests pass and coverage meets the target threshold

**Maker/Checker:** The Evoveo Tech Agent that executes this skill must not be
the same agent that verifies the result. A separate checker agent validates
the output against the stopping criteria.

## Skill Guidance

## Purpose
Choose effective automated and manual test layers for Godot features without overcomplicating the project.

## Use When
- adding tests to Godot systems
- scene-driven bugs are recurring
- CI and export confidence need improvement

## Inputs
- feature risk profile
- test tools
- scene dependencies
- export targets

## Process
1. cover deterministic logic with fast tests where possible
2. use scene-level tests only where lifecycle or integration risk justifies them
3. stabilize node and signal assumptions in fixtures
4. separate gating from exploratory or informational tests
5. track export and startup smoke coverage

## Outputs
- Godot test strategy
- candidate test cases
- fixture cautions
- CI notes

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
- qa-lead
- build-engineer

## Related Commands
- godot-review
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