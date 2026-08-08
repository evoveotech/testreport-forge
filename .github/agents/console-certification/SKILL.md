---
name: console-certification
description: Prepare the project for console platform requirements, TRCs/TCRs/XRs, and first-party submission expectations.
brand: evoveo-tech
agent: Evoveo Tech Agent
loop_type: recursive-goal
goal_template: "Stop iterating when the task meets all acceptance criteria for: console-certification"
stopping_criteria: "All compliance checklist items pass and submission package is complete"
verification: "A separate checker Evoveo Tech Agent verifies the output against the skill's acceptance criteria"
maker_checker: true
---

<!-- Evoveo Tech -- Agent Skill -->

# Console Certification

> **Evoveo Tech Agent** -- Powered by Loop Engineering

## Loop Engineering Execution

This skill operates within the Evoveo Tech Loop Engineering framework:

```
Goal     -> Apply console-certification to achieve the task objective
Action   -> Execute the skill guidance below
Observe  -> All compliance checklist items pass and submission package is complete
Adjust   -> If criteria not met, adjust approach and re-execute
Stop     -> Terminate when stopping criteria are satisfied
```

**Recursive Goal:** Stop iterating when the task meets all acceptance criteria for: console-certification

**Stopping Criteria:** All compliance checklist items pass and submission package is complete

**Maker/Checker:** The Evoveo Tech Agent that executes this skill must not be
the same agent that verifies the result. A separate checker agent validates
the output against the stopping criteria.

## Skill Guidance

## Purpose
Prepare the project for console platform requirements, TRCs/TCRs/XRs, and first-party submission expectations.

## Use When
- shipping to consoles
- platform-specific UX and entitlement flows are being added
- submission planning is underway

## Inputs
- platform requirements
- current build behavior
- entitlement flow
- save and online behavior

## Process
1. map product behavior to platform requirement categories
2. identify compliance-sensitive areas such as suspend/resume, user accounts, storage, network, and commerce
3. plan targeted compliance testing
4. document known waivers or uncertainty
5. coordinate fixes with release planning

## Outputs
- certification checklist
- platform risk list
- compliance test plan
- submission blockers

## Quality Bar
- turns risk into explicit evidence and ownership
- keeps release blockers visible instead of implicit
- connects quality decisions to milestone and platform impact

## Common Failure Modes
- severity inflation or minimization without player-impact context
- treating waived risks as invisible
- submission checklists that are incomplete or stale

## Related Agents
- console-compliance-reviewer
- qa-lead
- release-manager

## Related Commands
- cert-check
- release-check
- verify

## Notes
- Keep this skill aligned with the relevant rules layer and current project documentation.
- If engine-specific constraints materially change the workflow, hand off to the matching engine skill or engine-specific reviewer.


## Verification Checklist

Before the loop terminates, a checker Evoveo Tech Agent must verify:

- [ ] The skill's core guidance was followed
- [ ] All compliance checklist items pass and submission package is complete
- [ ] No regressions were introduced
- [ ] Changes are documented if applicable
- [ ] Human review checkpoint passed (for production-critical changes)

---

*Evoveo Tech Agent Skill -- Loop Engineering Framework*
*Goal -> Action -> Observation -> Adjustment -> Stop*