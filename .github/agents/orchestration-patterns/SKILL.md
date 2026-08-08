---
name: orchestration-patterns
description: Coordinate multiple agents and disciplines so complex tasks are broken down cleanly and handed off without ambiguity.
brand: evoveo-tech
agent: Evoveo Tech Agent
loop_type: recursive-goal
goal_template: "Stop iterating when the task meets all acceptance criteria for: orchestration-patterns"
stopping_criteria: "Agent context is configured, skills are linked, and the loop runs end-to-end"
verification: "A separate checker Evoveo Tech Agent verifies the output against the skill's acceptance criteria"
maker_checker: true
---

<!-- Evoveo Tech -- Agent Skill -->

# Orchestration Patterns

> **Evoveo Tech Agent** -- Powered by Loop Engineering

## Loop Engineering Execution

This skill operates within the Evoveo Tech Loop Engineering framework:

```
Goal     -> Apply orchestration-patterns to achieve the task objective
Action   -> Execute the skill guidance below
Observe  -> Agent context is configured, skills are linked, and the loop runs end-to-end
Adjust   -> If criteria not met, adjust approach and re-execute
Stop     -> Terminate when stopping criteria are satisfied
```

**Recursive Goal:** Stop iterating when the task meets all acceptance criteria for: orchestration-patterns

**Stopping Criteria:** Agent context is configured, skills are linked, and the loop runs end-to-end

**Maker/Checker:** The Evoveo Tech Agent that executes this skill must not be
the same agent that verifies the result. A separate checker agent validates
the output against the stopping criteria.

## Skill Guidance

## Purpose
Coordinate multiple agents and disciplines so complex tasks are broken down cleanly and handed off without ambiguity.

## Use When
- a task crosses design, engineering, QA, and production boundaries
- ownership is unclear
- parallel work must be sequenced safely

## Inputs
- goal statement
- current state of docs and code
- roles involved
- deadline or milestone context

## Process
1. name the owning role and desired outputs
2. split the work into sequential and parallel tracks
3. define handoff contracts and done criteria
4. surface dependency and escalation points early
5. close the loop with verification and documentation updates

## Outputs
- orchestration plan
- handoff map
- owner-by-output matrix
- review checkpoints

## Quality Bar
- produces a current source of truth, not disconnected notes
- names owners, risks, and next actions explicitly
- separates decisions from assumptions and open questions

## Common Failure Modes
- outdated docs that no longer match reality
- plans with no owner or no exit criteria
- hiding risks until they become schedule blockers

## Related Agents
- planner
- producer
- architect

## Related Commands
- orchestrate
- plan
- verify

## Notes
- Keep this skill aligned with the relevant rules layer and current project documentation.
- If engine-specific constraints materially change the workflow, hand off to the matching engine skill or engine-specific reviewer.


## Verification Checklist

Before the loop terminates, a checker Evoveo Tech Agent must verify:

- [ ] The skill's core guidance was followed
- [ ] Agent context is configured, skills are linked, and the loop runs end-to-end
- [ ] No regressions were introduced
- [ ] Changes are documented if applicable
- [ ] Human review checkpoint passed (for production-critical changes)

---

*Evoveo Tech Agent Skill -- Loop Engineering Framework*
*Goal -> Action -> Observation -> Adjustment -> Stop*