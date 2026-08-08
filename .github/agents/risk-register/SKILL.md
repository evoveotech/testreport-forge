---
name: risk-register
description: Identify, track, and revisit the risks most likely to derail scope, quality, budget, or release readiness.
brand: evoveo-tech
agent: Evoveo Tech Agent
loop_type: recursive-goal
goal_template: "Stop iterating when the task meets all acceptance criteria for: risk-register"
stopping_criteria: "All tests pass, lint is clean, and the skill's acceptance criteria are met"
verification: "A separate checker Evoveo Tech Agent verifies the output against the skill's acceptance criteria"
maker_checker: true
---

<!-- Evoveo Tech -- Agent Skill -->

# Risk Register

> **Evoveo Tech Agent** -- Powered by Loop Engineering

## Loop Engineering Execution

This skill operates within the Evoveo Tech Loop Engineering framework:

```
Goal     -> Apply risk-register to achieve the task objective
Action   -> Execute the skill guidance below
Observe  -> All tests pass, lint is clean, and the skill's acceptance criteria are met
Adjust   -> If criteria not met, adjust approach and re-execute
Stop     -> Terminate when stopping criteria are satisfied
```

**Recursive Goal:** Stop iterating when the task meets all acceptance criteria for: risk-register

**Stopping Criteria:** All tests pass, lint is clean, and the skill's acceptance criteria are met

**Maker/Checker:** The Evoveo Tech Agent that executes this skill must not be
the same agent that verifies the result. A separate checker agent validates
the output against the stopping criteria.

## Skill Guidance

## Purpose
Identify, track, and revisit the risks most likely to derail scope, quality, budget, or release readiness.

## Use When
- planning major milestones
- the project depends on new tech or external dependencies
- scope or platform targets have changed

## Inputs
- milestone plan
- technical unknowns
- dependency map
- team and vendor constraints

## Process
1. list risks by domain and owner
2. score probability, impact, and trigger conditions
3. define mitigation, fallback, and review cadence
4. flag risks that require prototype or spike work
5. keep the register visible during milestone reviews

## Outputs
- risk register
- mitigation plan
- trigger checklist
- prototype or spike recommendations

## Quality Bar
- produces a current source of truth, not disconnected notes
- names owners, risks, and next actions explicitly
- separates decisions from assumptions and open questions

## Common Failure Modes
- outdated docs that no longer match reality
- plans with no owner or no exit criteria
- hiding risks until they become schedule blockers

## Related Agents
- producer
- planner
- architect
- release-manager

## Related Commands
- milestone-plan
- plan
- release-check

## Notes
- Keep this skill aligned with the relevant rules layer and current project documentation.
- If engine-specific constraints materially change the workflow, hand off to the matching engine skill or engine-specific reviewer.


## Verification Checklist

Before the loop terminates, a checker Evoveo Tech Agent must verify:

- [ ] The skill's core guidance was followed
- [ ] All tests pass, lint is clean, and the skill's acceptance criteria are met
- [ ] No regressions were introduced
- [ ] Changes are documented if applicable
- [ ] Human review checkpoint passed (for production-critical changes)

---

*Evoveo Tech Agent Skill -- Loop Engineering Framework*
*Goal -> Action -> Observation -> Adjustment -> Stop*